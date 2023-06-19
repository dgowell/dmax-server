/**
* RANTR Utility Functions
*
* @dgowell
*/


/**
 * Create the main SQL DB
 */
function createDB(callback) {
    MDS.log("Creating DB");
    //Create the DB if not exists
    var initsql = "CREATE TABLE IF NOT EXISTS `clients` ( "
        + "  `id` bigint auto_increment, "
        + "  `publickey` varchar(512) NOT NULL, "
        + "  `expirydate` bigint NOT NULL, "
        + "  `createdat` bigint NOT NULL, "
        + "  `amount` bigint NOT NULL, "
        + "  `coinid` varchar(512) NOT NULL, "
        + "  `confirmed` boolean NOT NULL default false "
        + " )";

    //Run this..
    MDS.sql(initsql, function (msg) {
        if (callback) {
            callback(msg);
        }
    });
}

/*
* Check for expired MLS
*/
function checkExpiredMLS(callback) {
    //MDS.log("Checking for expired MLS");

    //Get the UNIX timestamp
    var now = Math.floor(Date.now() / 1000);

    //Select all the expired clients
    selectExpiredClients(now, function (sqlmsg) {
        //Loop through them
        if (sqlmsg.rows.length > 0) {
            MDS.log("Found " + sqlmsg.rows.length + " expired clients");
        }
        for (var i = 0; i < sqlmsg.rows.length; i++) {
            var row = sqlmsg.rows[i];
            //delete each one
            deleteClient(row['PUBLICKEY'], function (msg) {
                MDS.log("Deleted expired client from db" + row['PUBLICKEY']);
            });
            //remove client permanent address
            removePermanentAddress(row['PUBLICKEY'], function (msg) {
                MDS.log("Removed permanent address for " + row['PUBLICKEY']);
            });
        }
    });
}






/**
 * Select All the recent clients
 */
function selectExpiredClients(time, callback) {
    //MDS.log("Selecting expired clients");
    MDS.sql("SELECT * FROM CLIENTS WHERE expirydate<" + time + " AND confirmed=true", function (sqlmsg) {
        callback(sqlmsg);
    });
}

/**
 * Select a single client
 */
function selectClient(pk, callback) {
    MDS.sql("SELECT * FROM CLIENTS WHERE publickey='" + pk + "'", function (sqlmsg) {
        //Did we find it..
        if (sqlmsg.rows.length > 0) {
            callback(true, sqlmsg.rows[0]);
        } else {
            callback(false);
        }
    });
}

/**
 * Delete a Single Client form the DB
 */
function deleteClient(pk, callback) {
    MDS.log("Deleting client from db: " + pk);
    MDS.sql("DELETE FROM CLIENTS WHERE publickey='" + pk + "'", function (sqlmsg) {
        if (callback) {
            MDS.log("Deleted client from db" + pk);
            callback(sqlmsg);
        }
    });
}

/**
 * Set end date on client
 * @param {*} pk
 * @param {*} callback
 * @param {*} expirydate
 * @returns true
*/
function updateExpiryDate(pk, expirydate, callback) {
    MDS.sql("UPDATE CLIENTS SET expirydate=" + Number(expirydate) + " WHERE publickey='" + pk + "'", function (sqlmsg) {
        if (callback) {
            callback(sqlmsg);
        }
    });
}

/**
 * Add a client
 * @param {*} pk
 * @param {*} callback
 */
function addClient(pk, callback) {
    MDS.sql("INSERT INTO CLIENTS (publickey,expirydate) VALUES ('" + pk + "',0)", function (sqlmsg) {
        if (callback) {
            callback(sqlmsg);
        }
    });
}


/**
 * Add client pk to create permanent address
 */
function addPermanentAddress(pk, callback) {
    var maxcmd = "maxextra action:addpermanent publickey:" + pk;
    MDS.cmd(maxcmd, function (msg) {
        MDS.log(JSON.stringify(msg));
        if (callback) {
            callback(msg);
        }
    });
}

/**
 * Remove  expired client
 */
function removePermanentAddress(pk, callback) {
    MDS.log("Removing permanent address for " + pk);
    var maxcmd = "maxextra action:removepermanent publickey:" + pk;
    MDS.cmd(maxcmd, function (msg) {
        MDS.log(JSON.stringify(msg));
        if (callback) {
            MDS.log("Removed permanent address: " + JSON.stringify(msg));
            callback(msg);
        }
    });
}

/**
 * Send message via Maxima to contat address or permanent address
 */
function sendMessage(message, address, callback) {
    var maxcmd = "maxima action:send poll:true to:" + address + " application:dmax data:" + JSON.stringify(message);
    MDS.cmd(maxcmd, function (msg) {
        MDS.log(JSON.stringify(msg));
        if (callback) {
            callback(msg);
        }
    });
}

/**
 * Confirm coin exists and return the coin data response
 * @param {*} coinId
 * @param {*} callback
 * @returns coin data
 */
function getCoin(coinId, callback) {
    var maxcmd = "coins coinid:" + coinId;
    MDS.cmd(maxcmd, function (msg) {
        MDS.log(`Get Coin: ${JSON.stringify(msg)}`);
        if (callback) {
            callback(msg);
        }
    });
}

/**
 * Set Expiry Date
 * @param {*} pk
 * @param {*} callback
 * @param {*} expirydate
 * @returns true
 */
function setExpiryDate(pk, days, callback) {
    //get unix timestamp
    var now = Math.floor(Date.now() / 1000);
    //MDS.log("Now: " + now);
    //convert unixtimestam to time and date
    var date = new Date(now * 1000);
    MDS.log("Now Date: " + date);
    //  MDS.log("Days passed in: " + days);
    //convert whole number amount int   o days
    var unixDays = days * 86400;

    //and add to now
    var expirydate = now + unixDays;
    //var expirydate = now + 60000;

    //3mins in unixtime
    //var expirydate = now + 180;

    MDS.log("Expirydate: " + new Date(expirydate * 1000));
    //update expirydate
    updateExpiryDate(pk, expirydate, function (sqlmsg) {
        if (callback) {
            callback(sqlmsg);
        }
    });
}

/**
 * Get P2P Identity
 * @param {*} callback
 */
function getP2PIdentity(callback) {
    MDS.cmd("maxima", function (msg) {
        MDS.log(JSON.stringify(msg));
        if (callback) {
            callback(msg.response.p2pidentity);
        }
    });
}



/**
 * Store Payment Information
 * @param {*} pk
 * @param {*} amount
 * @param {*} coinId
 * @param {*} callback
 */
function storePayment(pk, amount, coinId, callback) {
    var now = Math.floor(Date.now() / 1000);
    var initsql = "INSERT INTO CLIENTS (publickey,expirydate,createdat,amount,coinid,confirmed) VALUES ('" + pk + "',0," + now + "," + amount + ",'" + coinId + "',false)";
    MDS.sql(initsql, function (msg) {
        MDS.log(`Response from storePayment: ${JSON.stringify(msg)}`);
        if (callback) {
            callback(msg);
        }
    });
}

/**
 * Check all unconfirmed payments
 * @param {*} callback
 */
function getUnconfirmedPayments(callback) {
    var sql = "SELECT * FROM CLIENTS WHERE confirmed=false";
    MDS.sql(sql, function (msg) {
        if (msg.count > 0) {
            MDS.log(`Response from getUnconfirmedPayments: ${JSON.stringify(msg)}`);
        }
        if (callback) {
            callback(msg);
        }
    });
}

function updateConfirmed(pk, callback) {
    MDS.log("Updating confirmed for " + pk);
    var sql = "UPDATE CLIENTS SET confirmed=true WHERE publickey='" + pk + "'";
    MDS.sql(sql, function (msg) {
        MDS.log(`Response from updateConfirmed: ${JSON.stringify(msg)}`);
        if (callback) {
            callback(msg);
        }
    });
}