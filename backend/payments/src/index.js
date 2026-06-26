const express=require("express");

require("dotenv").config();

const app=express();

app.use(express.json());

const paymentRoutes=require("./routes/paymentRoutes");

app.use("/payments",paymentRoutes);

const {

    connectNATS,

    getNatsConnection

}=require("./services/natsService");

const {

    subscribeToPayments

}=require("./services/paymentService");

const PORT=process.env.PORT || 3003;

async function start(){

    await connectNATS();

    subscribeToPayments();

    app.listen(PORT,()=>{

        console.log(`Payments running on ${PORT}`);

    });

}

start();