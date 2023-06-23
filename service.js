/**
* dmax backend service
*
* @dgowell
*/

//Load a file..
MDS.load("dmax.js");



const COIN_CHECK_MAX_ATTEMPTS = 15;
const COIN_CHECK_DELAY = 3000; //3 seconds

//Main message handler..
MDS.init(function (msg) {
    if (logs) {
        //MDS.log("dmax service received message: " + JSON.stringify(msg));
    }
    //Do initialisation
    if (msg.event == "inited") {

        //Create the DB if not exists
        createDB(function (msg) {
            MDS.log("SQL DB inited");
        });

    } else if (msg.event == "MAXIMA") {
        if (logs) {
            MDS.log("MAXIMA message received");
        }
        //Is it for dmax...
        if (msg.data.application == "dmax") {

            if (logs) {
                MDS.log("dmax message received");
            }
            //The Maxima user that sent this request
            var clientPK = msg.data.from;

            if (logs) {
                MDS.log("Public key: " + clientPK);
            }
            //Convert the data..
            MDS.cmd("convert from:HEX to:String data:" + msg.data.data, function (resp) {
                if (logs) {
                    MDS.log("Converted data: " + JSON.stringify(resp));
                }

                //And create the actual JSON
                var json = JSON.parse(resp.response.conversion);

                if (logs) {
                    MDS.log("JSON: " + JSON.stringify(json));
                }

                //What type is this..
                var type = json.type;

                if (type == "P2P_REQUEST") {
                    if (logs) {
                        MDS.log("P2P_REQUEST message received from " + clientPK);
                    }
                    var contact = json.data.contact;

                    //get p2pidentity
                    getP2PIdentity(function (p2pIdentity) {
                        if (logs) {
                            MDS.log("Got p2pIdentity: " + p2pIdentity);
                        }

                        // Send response to client via maxima, including the amount
                        sendMessage({ "type": "P2P_RESPONSE", "data": { "status": "OK", "p2pidentity": p2pIdentity } }, contact, function (msg) {
                            if (logs) {
                                MDS.log("Sent response to " + contact);
                            }
                        });
                    });
                }

                else if (type == "PAY_CONFIRM") {

                    if (logs) {
                        MDS.log("PAY_CONFIRM message received from " + clientPK);
                    }

                    //store payment in the database
                    storePayment({
                        amount: json.data.amount,
                        coinId: json.data.coinId,
                        callback: function (msg) {
                            if (logs) {
                                MDS.log("Payment stored in database");
                            }

                        }
                    });
                } else if (type == "PAYMENT_RECEIPT_READ") {

                    if (logs) {
                        MDS.log("PAYMENT_RECEIPT_READ message received from " + clientPK);
                    }

                    //store payment in the database
                    storePayment({
                        publickey: json.data.publickey,
                        amount: json.data.amount,
                        purchaseCode: json.data.purchase_code,
                        callback: function (msg) {
                            if (logs) {
                                MDS.log("Payment stored in database");
                            }

                        }
                    });


                } else {
                    if (logs) {
                        MDS.log("Unknown message type received from " + clientPK);
                    }
                }
            });
        }
    } else if (msg.event == "MDS_TIMER_10SECONDS") {
        //if (logs) { MDS.log("10 second timer"); }

        //Check for unconfirmed payments
        getUnconfirmedPayments(function (sqlmsg) {
            if (logs) {
                MDS.log("All clients with unconfirmed payments: " + JSON.stringify(sqlmsg));
            }

            for (var i = 0; i < sqlmsg.rows.length; i++) {
                var row = sqlmsg.rows[i];
                var clientPK = row['PUBLICKEY'];


                var coinIdFromClient = row['COINID'];

                MDS.log("Checking coin: " + coinIdFromClient);
                MDS.log("Checking client: " + clientPK);

                //if coinIdFromClient is not null then check the coin
                if (coinIdFromClient != null) {
                    getCoin(coinIdFromClient, function (coin) {
                        if (coin.response.length > 0) {
                            MDS.log("Coin is confirmed: " + coin.response[0].amount);

                            updateConfirmed(clientPK, function (msg) {
                                MDS.log("Updated confirmed for: " + clientPK);
                            });
                            // Set the date that the MLS will expire
                            var days = coin.response[0].amount;

                            registerClient(clientPK, days);

                        } //if

                    }); //confirmPayment
                } else {
                    const purchaseCode = row['PURCHASE_CODE'];
                    MDS.log("Checking purchase code: " + purchaseCode);

                    getHistoryTransactions(function (transactions) {
                        confirmCoin(purchaseCode, transactions, function (coin) {
                            MDS.log("Coin confirmed and see what strucutre it is: " + JSON.stringify(coin));
                            if (coin) {
                                updateConfirmed(clientPK, function (msg) {
                                    MDS.log("Updated confirmed for: " + clientPK);
                                });
                                // Set the date that the MLS will expire
                                var days = coin.amount;
                                MDS.log("Days: " + days);
                                registerClient(clientPK, days);
                            }
                        }
                        );
                    });

                }
            } //for
        }); //getUnconfirmedPayments

        checkExpiredMLS(function (msg) {
            MDS.log("Checked for expired MLS");
        });

    } else if (msg.event == "MDS_TIMER_1HOUR") {
        if (logs) {
            MDS.log("RUNS EVERY HOUR - Checking for expired MLS");
        }
        // //Check, remove and delete expired MLS
        checkExpiredMLS(function (msg) {
            MDS.log("Checked for expired MLS");
        });
    }
});

function registerClient(clientPK, days) {
    // Add the clients permanent maxima address
    addPermanentAddress(clientPK, function (msg) {
        if (logs) {
            MDS.log("Added permanent address for " + clientPK);
        }

        setExpiryDate(clientPK, days, function (expirydate) {
            if (logs) {
                MDS.log("Set expiry date for " + clientPK);
            }

            //get p2pidentity
            getP2PIdentity(function (p2pIdentity) {
                if (logs) {
                    MDS.log("Got p2pIdentity: " + p2pIdentity);
                }
                //TODO
                //add in funciton to compose perm address
                var permAddress = `MAX#${clientPK}#${p2pIdentity}`;

                // Send response to client via maxima
                sendMessage({
                    "type": "EXPIRY_DATE",
                    "data": {
                        "status": "OK",
                        "expiry_date": expirydate,
                        "permanent_address": permAddress
                    }
                },
                    permAddress, function (msg) {
                        if (logs) {
                            MDS.log("Sent expiry date to " + permAddress);
                        }
                    }); //sendMessage
            });
        }); //setExpiryDate
    }); //addPermanentAddress
}