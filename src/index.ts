import {startWorker, zBClient} from "./zeebeWorker"
import {LoggerAdaptToConsole} from "console-log-json";
import {validateEnv} from "./validateEnv";

require('dotenv').config()

LoggerAdaptToConsole()

process.on('SIGINT', function () {
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
  // some other closing procedures go here
  console.log('Closing any worker client running...')
  zBClient.close().then(() => console.log('All workers closed'))
  process.exit();
})

validateEnv()

startWorker()
