/**
* RANTR Utility Functions
*
* @dgowell
*/

/**
 * Global variables
 */
var SERVER_WALLET = "0x000000000";


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

/*
* Remove
 
 
 
 
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















/**
 * Create a Chatter message
 */
function createRant(basemessage, parentid, baseid, callback) {

    //URL Encode everything..
    var message = encodeStringForDB(basemessage);
    var username = encodeStringForDB(MAXIMA_USERNAME);

    if (message.length > MAX_MESSAGE_LENGTH) {
        MDS.log("MESSAGE TOO LONG! for createRant..");
        //Too long..
        callback(null);
        return;
    }

    //Construct the base message JSON..
    var msgjson = {};

    msgjson.publickey = MAXIMA_PUBLICKEY;
    msgjson.username = username;
    msgjson.message = message;
    msgjson.parentid = parentid;
    msgjson.baseid = baseid;
    msgjson.date = (new Date()).getTime();

    //Make the HASH unique - even for the same message at the same time
    msgjson.randomid = Math.random() + "";

    //Convert to a string
    var msgstr = JSON.stringify(msgjson);

    //Calculate the msgid
    MDS.cmd("hash data:" + msgstr, function (hashmsg) {

        //The HASH of the message
        var msgid = hashmsg.response.hash;

        //Sign this message
        MDS.cmd("maxsign data:" + msgid, function (msg) {

            //The signatrure of the hash
            var signature = msg.response.signature;

            //Now the actual CHATTER message
            var chatter = {};
            chatter.type = "MESSAGE"
            chatter.message = msgjson;
            chatter.messageid = msgid;
            chatter.signature = signature;

            //MDS.log("CHATTER:"+JSON.stringify(chatter,null,2));

            //Now we have a RANT
            if (callback) {
                callback(chatter);
            }
        });
    });
}

/**
 * Create message request
 */
function createMessageRequest(msgid, callback) {
    //Now the actual CHATTER message
    var chatter = {};
    chatter.type = "MESSAGE_REQUEST";
    chatter.messageid = msgid;

    //Now we have a RANT
    if (callback) {
        callback(chatter);
    }
}

/**
 * Check a RANT
 */
function checkRant(chatter, callback) {
    //Convert to a string
    var msgstr = JSON.stringify(chatter.message);

    //Calculate the msgid
    MDS.cmd("hash data:" + msgstr, function (msg) {
        var msgid = msg.response.hash;

        //Check this is valid..
        if (msgid != chatter.messageid) {
            MDS.log("INVALID MESSAGEID in Chatter message " + JSON.stringify(chatter));
            callback(false);
            return;
        }

        //Now verify the signature
        MDS.cmd("maxverify data:" + msgid + " publickey:" + chatter.message.publickey + " signature:" + chatter.signature, function (msg) {
            if (!msg.response.valid) {
                MDS.log("INVALID SIGNATURE in Chatter message " + JSON.stringify(chatter));
                callback(false);
                return;
            }

            //All good
            callback(true);
        });
    });
}

/**
 * Post a message Over Chatter
 */
function postRant(chatter, callback) {
    //TEST
    //var maxcmd = "maxima action:send to:"+MAXIMA_CONTACT+" application:chatter data:"+JSON.stringify(rant);

    var maxcmd = "maxima action:sendall application:chatter data:" + JSON.stringify(chatter);
    MDS.cmd(maxcmd, function (msg) {
        //MDS.log(JSON.stringify(msg));
        if (callback) {
            callback(msg);
        }
    });
}

/**
 * Post a message to a Maxima Contact
 */
function postMessageToPublickey(chatter, publickey, callback) {
    var maxcmd = "maxima action:send poll:true publickey:" + publickey + " application:chatter data:" + JSON.stringify(chatter);
    MDS.cmd(maxcmd, function (msg) {
        //MDS.log(JSON.stringify(msg));
        if (callback) {
            callback(msg);
        }
    });
}

/*
 * Do we already have this Chatter message
 */
function checkInDB(msgid, callback) {
    MDS.sql("SELECT id FROM MESSAGES WHERE messageid='" + msgid + "'", function (sqlmsg) {
        callback(sqlmsg.count > 0);
    });
}

function encodeStringForDB(str) {
    return encodeURIComponent(str).split("'").join("%27");
    //return encodeURIComponent(str).replaceAll("'", "%27");
}

function decodeStringFromDB(str) {
    return decodeURIComponent(str).split("%27").join("'");
    //return decodeURIComponent(str).replaceAll("%27", "'");
}

/**
 * Add a Chatter message to the DB - it has already ben checked!
 */
function addRantToDB(chatter, callback) {

    //What is the striung of the message
    var fullchat = JSON.stringify(chatter);

    //Get the actual rant
    var msgjson = chatter.message;

    //Date as of NOW
    var recdate = new Date();

    //Is this a TOP message
    var baseid = msgjson.baseid;
    if (msgjson.parentid == "0x00") {
        baseid = chatter.messageid;
    }

    //The SQL to insert
    var insertsql = "INSERT INTO messages(chatter,publickey,username,message,messageid,parentid,baseid,msgdate,recdate) VALUES " +
        "('" + fullchat + "','"
        + msgjson.publickey + "','"
        + msgjson.username + "','"
        + msgjson.message + "','"
        + chatter.messageid + "','"
        + msgjson.parentid + "','"
        + baseid + "',"
        + msgjson.date + "," + recdate.getTime() + ")";

    MDS.sql(insertsql, function (sqlmsg) {
        if (callback) {
            callback(sqlmsg);
        }
    });
}

function requestUserToBeSuperChatter(pubkey, username) {
    if (!SHOW_SUPER_CHATTER_WARNING) {
        return makeUserASuperChatter(pubkey, username);
    }

    document.getElementById('make-super-chatter-modal').style.display = 'block';
    document.getElementById('make-super-chatter-button').addEventListener('click', function () {
        if (document.getElementById('make-super-chatter-warning-checkbox').checked) {
            var query = "SELECT * FROM settings WHERE key = 'SHOW_SUPER_CHATTER_WARNING'";

            return MDS.sql(query, function (msg) {
                if (msg.count === 0) {
                    query = `INSERT INTO settings (k, v) VALUES ('SHOW_SUPER_CHATTER_WARNING', '1')`;
                } else {
                    query = `UPDATE settings SET v = '1' WHERE k 'SHOW_SUPER_CHATTER_WARNING'`;
                }

                return MDS.sql(query, function () {
                    SHOW_SUPER_CHATTER_WARNING = false;

                    makeUserASuperChatter(pubkey, username);
                });
            });
        }

        makeUserASuperChatter(pubkey, username);
    });
}

function makeUserASuperChatter(pubkey, username) {
    var sql = "INSERT INTO superchatter (publickey,username) VALUES ('" + pubkey + "','" + username + "')";

    MDS.sql(sql, function () {
        window.location.reload(true);
    });
}

/**
 * @param pubkey
 * @param username
 */
function removeUserSuperChatter(pubkey, username) {
    var sql = "DELETE FROM superchatter WHERE publickey='" + pubkey + "'";

    MDS.sql(sql, function () {
        window.location.reload(true);
    });
}

function checkWarnings() {
    var query = "SELECT * FROM settings WHERE k = 'SHOW_RE_CHATTER_WARNING'";

    MDS.sql(query, function (msg) {
        if (msg.count > 0) {
            SHOW_RE_CHATTER_WARNING = false;
        }

        var query = "SELECT * FROM settings WHERE k = 'SHOW_SUPER_CHATTER_WARNING'";

        MDS.sql(query, function (msg) {
            if (msg.count > 0) {
                SHOW_SUPER_CHATTER_WARNING = false;
            }
        });
    });
}

function setReChatterWarningToDisabled(callback) {
    var query = "SELECT * FROM settings WHERE key = 'SHOW_RE_CHATTER_WARNING'";

    MDS.sql(query, function (msg) {
        if (msg.count === 0) {
            query = `INSERT INTO settings (k, v) VALUES ('SHOW_RE_CHATTER_WARNING', '1')`;
        } else {
            query = `UPDATE settings SET v = '1' WHERE k 'SHOW_RE_CHATTER_WARNING'`;
        }

        SHOW_RE_CHATTER_WARNING = false;

        MDS.sql(query, callback);
    });
}