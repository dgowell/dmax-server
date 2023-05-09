/**
* RANTR Utility Functions
*
* @dgowell
*/


/**
 * Create the main SQL DB
 */
function createDB(callback) {

    //Create the DB if not exists
    var initsql = "CREATE TABLE IF NOT EXISTS `clients` ( "
        + "  `id` bigint auto_increment, "
        + "  `publickey` varchar(512) NOT NULL, "
        + "  `expirydate` bigint NOT NULL, "
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
    //Get the UNIX timestamp
    var now = Math.floor(Date.now() / 1000);

    //Select all the expired clients
    selectExpiredClients(now, function (sqlmsg) {
        //Loop through them
        for (var i = 0; i < sqlmsg.rows.length; i++) {
            var row = sqlmsg.rows[i];
            //delete each one
            deleteClient(row.publickey, function (msg) {
                MDS.log("Deleted expired client from db" + row.publickey);
            });
            //remove client permanent address
            removePermanentAddress(row.publickey, function (msg) {
                MDS.log("Removed permanent address for " + row.publickey);
            });
        }
    });
}






/**
 * Select All the recent clients
 */
function selectExpiredClients(time, callback) {
    MDS.sql("SELECT * FROM CLIENTS WHERE expirydate>" + time, function (sqlmsg) {
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
    MDS.sql("DELETE FROM CLIENTS WHERE publickey='" + pk + "'", function (sqlmsg) {
        if (callback) {
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
    MDS.sql("UPDATE CLIENTS SET expirydate=" + expirydate + " WHERE publickey='" + pk + "'", function (sqlmsg) {
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
    var maxcmd = "maxextra action:removepermanent publickey:" + pk;
    MDS.cmd(maxcmd, function (msg) {
        MDS.log(JSON.stringify(msg));
        if (callback) {
            callback(msg);
        }
    });
}

/**
 * Send message via Maxima to contat address or permanent address
 */
function sendMaximaMessage(message, address, callback) {
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
function confirmPayment(coinId, callback) {
    var maxcmd = "coins coinid:" + coinId;
    MDS.cmd(maxcmd, function (msg) {
        MDS.log(JSON.stringify(msg));
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
function setExpiryDate(pk, amount, callback) {
    //get unix timestamp
    var now = Math.floor(Date.now() / 1000);

    //convert whole number amount into days
    amount = amount * 86400;

    //and add to now
    var expirydate = now + amount;

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











