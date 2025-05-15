const Deposit = require("../models/deposit");
const Payment = require("../models/payments");
const User = require("./../models/user");
const Fund = require("./../models/fund");
const axios = require("axios");
const crypto = require("crypto");

exports.addDepositRequest = async function (req, res) {
  try {
    const is_valid = await Deposit.checkLastRequest(req.body.user_id);
    if(!is_valid){
      return res.status(200).json({'error':'One request is already pending.'});
    }
    const is_refvalid = await Deposit.checkRefNo(req.body.user_id,req.body.transaction_id);
    if(!is_refvalid){
      return res.status(200).json({'error':"You cann't use same utr twice."});
    }
    let new_deposit_request = new Deposit(req.body);
    const fileUrl = "/" + req.file.filename;
    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res
        .status(400)
        .send({ error: true, message: "Please provide all required field" });
    } else {
      let deposit_request = await Deposit.addDepositRequest(
        new_deposit_request,
        fileUrl
      );
      res.status(200).send(deposit_request);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error getting data");
  }
};

exports.getUserDepositRequest = async function (req, res) {
  try {
    let user_id = req.params.user_id;
    let user_requests = await Deposit.getUserDepositRequests(user_id);
    res.status(200).send(user_requests);
  } catch (error) {
    console.log(err);
    res.status(500).send("Error getting data");
  }
};

exports.getAdminDepositRequest = async function (req, res) {
  try {
    console.log('adminnnn');
    let status = req.params.status;
    let days = req.params.days;
    let admin_id = 1;
    if(req.userData.user.role!=6){
      admin_id = req.params.admin_id;
    }
    let user_requests = await Deposit.getAdminDepositRequests(admin_id,status,days);
    res.status(200).send(user_requests);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error getting data");
  }
};

exports.updateStatusDepositRequest = async function (req, res) {
  try {
    let status = req.body.status;
    let user_id = req.body.user_id;
    let req_id = req.body.req_id;
    let user_requests = await Deposit.updateStatusDepositRequest(
      status,
      user_id,
      req_id
    );
    res.status(200).send(user_requests);
  } catch (error) {
    console.log(err);
    res.status(500).send("Error getting data");
  }
};

exports.completeSunpay = async function (req, res) {
  try {
    const {
        mchId,
        mchOrderNo,
        orderDate,
        oriAmount,
        tradeResult,
        signType,
        sign,
        merRetMsg,
        orderNo
    } = req.body;
    // console.log(req.body)
    const data = JSON.stringify(req.body);

    const payment = await Payment.checkPayment(mchOrderNo);
    if (payment) {
        if (payment.status == '0') {
            const userId = ""+payment.user_id;
            const depositId = ""+payment.deposit_id;
            if(tradeResult=='1'){
              await Payment.complatePayment(mchOrderNo,data);
              await Deposit.updateStatusDepositRequest(1,userId,depositId);
              const transferData = {
                'amount':payment.amount,
                'transfer_by':1,
                'transfer_from_id':1,
                'transfer_to_id':userId
              }
              User.fundTransfer(transferData, function (err, data) {
                  if (err) {
                    res.send(err);
                  } else {
                    Fund.create(transferData, function (err, data) {
                      if (err) {
                        res.send(err);
                      } else {
                        res.json({
                          error: false,
                          message: "funds added into fundmaster successfully!",
                          data: data
                        });
                      }
                    });
                  }
              });
            }else{
              await Payment.complatePayment(mchOrderNo,data);
              await Deposit.updateStatusDepositRequest(-1,userId,depositId);
            }
        } else {
          console.log('Recharge status is already completed. Skipping user money update.');
        }
    } else {
        console.log('Transaction not found.');
    }
    return res.status(200).json({'status':"complete"});
  } catch (error) {
      console.log(error);
  }
}
exports.initPayment = async function (req, res) {
  let timeNow = Date.now();
  const depositurl = "https://100xwins.com/dashboard/deposit";
  const callbackurl = "https://api.100xwins.com/api/v1/deposit/complate-sunpay";
  const SUNPAY_API_URL = "https://pay.sunpayonline.xyz/pay/web";
  const MERCHANT_ID = "202018018";
  const API_KEY = "d6a9e8b35d6d4a0d8fbc8080c049da8f";
  
  try {
      let inputAmount = parseInt(req.body.amount);
      const minimumMoneyAllowed = 200;

      if (!inputAmount || inputAmount < minimumMoneyAllowed) {
          return res.status(200).json({
              message: `Money is required and should be ₹${minimumMoneyAllowed} or above!`,
              status: false,
              timeStamp: timeNow,
          });
      }

      const order_no = generateOrderId();
      const date = new Date().toISOString().slice(0, 19).replace("T", " ");

      const payload = {
        version: "1.0",
        mch_id: MERCHANT_ID,
        mch_order_no: order_no,
        pay_type: "102",
        trade_amount: inputAmount,
        order_date: date,
        goods_name: "user goods_name",
        notify_url: callbackurl,
        page_url: depositurl,
        mch_return_msg: "user mch_return_msg",
      };
      payload.sign = generateSign(payload, API_KEY);
      payload.sign_type = "MD5";

      const response = await axios.post(SUNPAY_API_URL, new URLSearchParams(payload).toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
  
      if(response.data.respCode == 'FAIL'){
        return res.status(200).json({
          message: response.data.tradeMsg,
          status: false,
          timeStamp: timeNow,
        });
      }

      const new_deposit_request = {
        user_id: req.userData.user.id,
        admin_id: 1,
        method:"ACCOUNT",
        transaction_id: order_no,
        amount: inputAmount,
        username: req.userData.user.username,
        source:'online',
        depo_proof:"gateway",
        status:0
      }

      let deposit_request = await Deposit.addDepositRequest2(
        new_deposit_request
      );

      await Payment.create({
        user_id: new_deposit_request.user_id,
        order_id: new_deposit_request.transaction_id,
        deposit_id: deposit_request,
        amount: new_deposit_request.amount,
        status: new_deposit_request.status,
        //payInfo: response.data,
        created_at: date
      });

      return res.status(200).json({
          message: "Payment Initiated successfully",
          //data: response.data,
          payInfo: response.data.payInfo,
          status: true,
          timeStamp: timeNow,
      });
  } catch (error) {
      console.log(error);
      res.status(500).json({
          status: false,
          message: "Something went wrong!",
          timeStamp: timeNow
      });
  }
};

function generateSign(params, secretkey) {
  params = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (key !== "sign") {
        acc.push(`${key}=${params[key]}`);
      }
      return acc;
    }, [])
    .join("&");

  const signStr = `${params}&key=${secretkey}`;
  return crypto.createHash("md5").update(signStr).digest("hex");
}

function generateOrderId() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const orderId = `ORDER-${timestamp}-${randomString}`;
  return orderId;
}
