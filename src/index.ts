import {startWorker, zBClient} from "./zeebeWorker"
import { LoggerAdaptToConsole } from "console-log-json";
import {readFolder, uploadPDF} from "./ged-connector"

require('dotenv').config()

// Start logging as JSON if we are not in debug mode
if (!process.env.DEBUG?.search('/\*/')) {
    LoggerAdaptToConsole()
}

process.on( 'SIGINT', function() {
    console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
    // some other closing procedures go here
    console.log('Closing any worker client running...')
    zBClient.close().then(() => console.log('All workers closed'))
    process.exit( );
})

//startWorker()

const jobVariables = {
    phdStudentName: process.env.PHDSTUDENTNAME1!,
    phdStudentSciper: process.env.PHDSUTDENTSCIPER1!,
}
const doctoratID = process.env.PHDSTUDENTDOCTORAT1!

const pdfFileName = `Rapport annuel doctorat1.pdf`
const base64String = process.env.PDFSTRING!
const pdfFile = Buffer.from(base64String, 'base64')

// readFolder(jobVariables.phdStudentName, jobVariables.phdStudentSciper, doctoratID!)
// before sending, check that the user folder is fine
uploadPDF(jobVariables.phdStudentName, jobVariables.phdStudentSciper, doctoratID, pdfFileName, pdfFile)
