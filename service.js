/**
* dmax backend service
*
* @dgowell
*/

//Load a file..
MDS.load("dmax.js");

//Are we logging data
var logs = true;
const COIN_CHECK_MAX_ATTEMPTS = 15;
const COIN_CHECK_DELAY = 3000; //3 seconds

//Main message handler..
MDS.init(function (msg) {
    if (logs) {
        MDS.log("dmax service received message: " + JSON.stringify(msg));
    }
    //Do initialisation
    if (msg.event == "inited") {

        //Create the DB if not exists
        createDB(function (msg) {
            MDS.log("SQL DB inited");
        });

        //Check rechatter messages
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
            var publickey = msg.data.from;

            if (logs) {
                MDS.log("Public key: " + publickey);
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
                        MDS.log("P2P_REQUEST message received from " + publickey);
                    }
                    // Get the amount from the original P2P_REQUEST
                    var amount = json.data.amount;
                    var contact = json.data.contact;

                    // Send response to client via maxima, including the amount
                    sendMaximaMessage({ "type": "P2P_RESPONSE", "data": { "status": "OK", "amount": amount } }, contact, function (msg) {
                        if (logs) {
                            MDS.log("Sent response to " + contact);
                        }
                    });
                }

                else if (type == "PAY_CONFIRM") {
                    if (logs) {
                        MDS.log("PAY_CONFIRM message received from " + publickey);
                    }
                    // Get the coin id the client has sent
                    var coinId = json.data.coin_id;

                    var attempts = 0;
                    var coinNotFound = true;
                    while (attempts < COIN_CHECK_MAX_ATTEMPTS && coinNotFound) {
                        // Confirm payment
                        setInterval(confirmPayment(coinId, function (msg) {
                            if (logs) {
                                MDS.log("Payment confirmed, response: " + JSON.stringify(msg));
                            }
                            //check that a coin was found before contuniing
                            if (msg.status == true) {
                                coinNotFound = false;

                                var coinAmount = msg.response[0].amount;
                                if (logs) {
                                    MDS.log("Coin Amount: " + coinAmount);
                                }

                                // Add the clients permanent maxima address
                                addPermanentAddress(publickey, function (msg) {
                                    if (logs) {
                                        MDS.log("Added permanent address for " + publickey);
                                    }

                                    var days = coinAmount;

                                    // Set the date that the MLS will expire
                                    setExpiryDate(days, function (expirydate) {
                                        if (logs) {
                                            MDS.log("Set expiry date for " + publickey);
                                        }

                                        getP2PIdentity(function (p2p) {
                                            var permAddress = 'MAX#' + publickey + '#' + p2p;
                                            if (logs) {
                                                MDS.log("Got P2P identity for " + publickey);
                                            }
                                            // Send response to client via maxima
                                            sendMaximaMessage({ "type": "EXPIRY_DATE", "data": { "status": "OK", "expiry_date": expirydate, "permanent_address": permAddress } }, permAddress, function (msg) {
                                                if (logs) {
                                                    MDS.log("Sent expiry date to " + publickey);
                                                }
                                            }); //sendMaximaMessage
                                        }); //getP2PIdentity
                                    }); //setExpiryDate
                                }); //addPermanentAddress
                            } else {
                                attempts++;
                                if (attempts == MAX_ATTEMPTS) {
                                    MDS.log("Could not find coin, max attempts tried!");
                                }
                            }
                        }), COIN_CHECK_DELAY);  //confirmPayment on 10 sec timer
                    } //endwhile
                } else {
                    if (logs) {
                        MDS.log("Unknown message type received from " + publickey);
                    }
                }
            });
        }
    } else if (msg.event == "MDS_TIMER_1HOUR") {
        if (logs) {
            MDS.log("Checking for expired MLS");
        }
        // //Check, remove and delete expired MLS
        removeExpiredMLS(function (msg) {
            MDS.log("Checked for expired MLS");
        });
    }
});

