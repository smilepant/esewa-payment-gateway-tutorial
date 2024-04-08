const express = require("express");
const bodyParser = require("body-parser");
const connectToMongo = require("./db");
const app = express();
const { getEsewaPaymentHash, verifyEsewaPayment } = require("./esewa");
const Payment = require("./paymentModel");
const Item = require("./itemModel");
const PurchasedItem = require("./purchasedItemModel");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
app.use(bodyParser.json());

connectToMongo();

app.post("/initialize-esewa", async (req, res) => {
  try {
    const { itemId, totalPrice } = req.body;

    const itemData = await Item.findOne({
      _id: itemId,
      price: Number(totalPrice),
    });

    if (!itemData) {
      return res.status(400).send({
        success: false,
        message: "item not found",
      });
    }
    const purchasedItemData = await PurchasedItem.create({
      item: itemId,
      paymentMethod: "esewa",
      totalPrice: totalPrice,
    });
    const paymentInitate = await getEsewaPaymentHash({
      amount: totalPrice,
      transaction_uuid: purchasedItemData._id,
    });

    res.json({
      success: true,
      payment: paymentInitate,
      purchasedItemData,
    });
  } catch (error) {
    res.json({
      success: false,
      error,
    });
  }
});

// to verify payment this is our `success_url`
app.get("/complete-payment", async (req, res) => {
  const { data } = req.query;

  try {
    const paymentInfo = await verifyEsewaPayment(data);
    const purchasedItemData = await PurchasedItem.findById(
      paymentInfo.response.transaction_uuid
    );
    if (!purchasedItemData) {
      res.status(500).json({
        success: false,
        message: "Purchase not found",
      });
    }
    // Create a new payment record
    const paymentData = await Payment.create({
      pidx: paymentInfo.decodedData.transaction_code,
      transactionId: paymentInfo.decodedData.transaction_code,
      productId: paymentInfo.response.transaction_uuid,
      amount: purchasedItemData.totalPrice,
      dataFromVerificationReq: paymentInfo,
      apiQueryFromUser: req.query,
      paymentGateway: "esewa",
      status: "success",
    });

    //updating purchased record
    await PurchasedItem.findByIdAndUpdate(
      paymentInfo.response.transaction_uuid,
      {
        $set: {
          status: "completed",
        },
      }
    );
    // Send success response
    res.json({
      success: true,
      message: "Payment Successful",
      paymentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred",
      error,
    });
  }
});

app.get("/create-item", async (req, res) => {
  let itemData = await Item.create({
    name: "Headphone",
    price: 500,
    inStock: true,
    category: "vayo pardaina",
  });
  res.json({
    success: true,
    item: itemData,
  });
});

app.get("/test", function (req, res) {
  res.sendFile(__dirname + "/test.html");
});

app.listen(3001, () => {
  console.log("Backend listening at http://localhost:3001");
});
