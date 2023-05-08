/**
* dmax backend service
*
* @dgowell
*/

//Load a file..
MDS.load("dmax.js");

//Are we logging data
var logs = false;

//Main message handler..
MDS.init(function (msg) {

    //Do initialisation
    if (msg.event == "inited") {

        //Create the DB if not exists
        createDB(function (msg) {
            MDS.log("SQL DB inited");
        });

    // Run this function at intervals of every 6 hours
    setInterval(function () {
    // Check and handle expired clients
    handleExpiredClients(function (msg) {
        MDS.log("Handled expired clients");
    });
}, 21600000); // 6 hours

        //Check rechatter messages
    } else if (msg.event == "MAXIMA") {

        //Is it for dmax...
        if (msg.data.application == "dmax") {

            //The Maxima user that sent this request
            var publickey = msg.data.from;

            //Convert the data..
            MDS.cmd("convert from:HEX to:String data:" + msg.data.data, function (resp) {

                //And create the actual JSON
                //TODO: Check that conversion is part of the response
                var json = JSON.parse(resp.response.conversion);

                //What type is this..
                var type = json.type;

                if (type == "P2P_REQUEST") {
                    // Get the amount from the original P2P_REQUEST
                    var amount = json.data.amount;
                    var contact = json.data.contact;

                    // Send response to client via maxima, including the amount
                    sendMaximaMessage(contact, { "type": "P2P_RESPONSE", "data": { "status": "OK", "amount": amount } }, function (msg) {
                        MDS.log("Sent response to " + contact);
                    });
                }

                else if (messagetype == "PAYMENT_CONFIRMATION") {
                    // Get the coin id the client has sent
                    var coinId = json.data.coin_id;

                    // Confirm payment
                    confirmPayment(coinId, function (msg) {
                        var amount = msg.response.amount;

                        // Add the clients permanent maxima address
                        addPermanentAddress(publickey, function (msg) {
                            MDS.log("Added permanent address for " + publickey);

                            // Set the date that the MLS will expire
                            setExpiryDate(amount, function (expirydate) {
                                MDS.log("Set expire date for " + publickey);

                                getP2PIdentity(function (p2p) {
                                    var permAddress = 'MAX#' + publickey + '#' + p2p;
                                    MDS.log('Permanent Address: ' + permAddress);
                                    // Send response to client via maxima
                                    sendMaximaMessage(permAddress, { "type": "EXPIRY_DATE", "data": { "status": "OK", "expiry_date": expirydate } }, function (msg) {
                                        MDS.log("Sent response to " + publickey);
                                    });
                                });
                            });
                        });
                    });
                } else {
                    MDS.log("INVALID message type in dmax server: " + messagetype);
                }
            });
        }
    }
});
