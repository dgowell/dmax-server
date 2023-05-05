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

                    //Add the clients permanent maxima address
                    addPermanentAddress(publickey, function (msg) {
                        MDS.log("Added permanent address for " + publickey);

                        //send response to client via maxima
                        sendMaximaMessage(publickey, { "type": "P2P_RESPONSE", "data": { "status": "OK" } }, function (msg) {
                            MDS.log("Sent response to " + publickey);
                        });

                    });

                } else if (messagetype = "PAYMENT_CONFIRMATION") {

                    //get the coin id the client has sent
                    var coinId = json.data.coin_id;

                    //confirm payment
                    confirmPayment(coinId, function (msg) {
                        var amount = msg.response.amount;

                        //set the date that the MLS will expire
                        var expirydate = setExpiryDate(amount, function (msg) {
                            MDS.log("Set expire date for " + publickey);
                            x
                            //send response to client via maxima
                            sendMaximaMessage(publickey, { "type": "EXPIRY_DATE", "data": { "status": "OK", "expiry_date": expirydate } }, function (msg) {
                                MDS.log("Sent response to " + publickey);
                            });
                        });
                    });
                } else {
                    MDS.log("INVALID message type in dmax server" + messagetype);
                }
            });
        }
    }
});