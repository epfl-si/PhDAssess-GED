import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'
import type {PhDAssessVariables} from "phd-assess-meta/types/variables";
import {decryptVariables, encrypt} from "./encryption";
import {flatPick} from "./utils";
import {
  alfrescoBaseURL,
  fetchTicket,
  readFolder,
  uploadPDF,
  buildStudentName
} from "phdassess-ged-connector";

const version = require('./version.js');

const debug = debug_('phd-assess/zeebeWorker')

export const zBClient = new ZBClient({
  pollInterval: Duration.seconds.of(10),
})

const taskType = process.env.ZEEBE_TASK_TYPE ? process.env.ZEEBE_TASK_TYPE : ''

// list which variables are not encrypted.
const alreadyDecryptedVariables = [
  'dashboardDefinition',
  'uuid',
]

const handler: ZBWorkerTaskHandler = async (
  job
) => {
  debug(`Task variables ${job.variables}`)
  debug(`Job "${taskType}" started`);

  console.log("Received and starting task", {
    taskType,
    job: flatPick(job,
      [
        'key',
        'processInstanceKey',
        'processDefinitionVersion',
        'elementId',
        'worker',
        'variables.created_at',
        'variables.created_by',
      ]
    )
  })

  const jobVariables = decryptVariables(job, alreadyDecryptedVariables)

  const phdStudentName = buildStudentName(jobVariables)

  const phdStudentSciper = jobVariables.phdStudentSciper ?? ''
  const doctoralAcronym = jobVariables.doctoralProgramName ?? ''

  const getPDFName = () => {
    const date = new Date()
    return `Rapport annuel doctorat ${date.toISOString().slice(0,10)}.pdf`
  }

  const pdfFileName = getPDFName()

  const base64String = jobVariables.PDF ?? ''
  const pdfFileBuffer = Buffer.from(base64String, 'base64')

  try {
    // first get a new ticket for incoming operations or fail trying
    const ticket = await fetchTicket(
      process.env.ALFRESCO_USERNAME!,
      process.env.ALFRESCO_PASSWORD!,
      process.env.ALFRESCO_URL!
    )

    try {
      // check if the awaited student folder exists
      await readFolder(
        process.env.ALFRESCO_URL!,
        {
          studentName: phdStudentName,
          sciper: phdStudentSciper,
          doctoralAcronym: doctoralAcronym,
        },
        ticket
      )

      // ok, looks fine, now try to deposit the pdf
      try {
        const finalPdfFileName = await uploadPDF(
          process.env.ALFRESCO_URL!,
          {
            studentName: phdStudentName,
            sciper: phdStudentSciper,
            doctoralAcronym: doctoralAcronym,
          },
          ticket,
          pdfFileName,
          pdfFileBuffer
        )

        console.log(`Successfully uploaded the ${finalPdfFileName} for ${phdStudentName} (${phdStudentSciper})`)

        const updateBrokerVariables = {
          gedDepositedDate: encrypt(new Date().toISOString()),
        }

        return job.complete(updateBrokerVariables)

      } catch (e: any) {
        console.log(`Unable to send the PDF file. Error was : ${e.message}`)
        return job.error('504', `Unable to upload the PDF. ${e.message}`)
      }
    } catch (e: any) {
      console.error(`Failed to read the student folder. Erroring was ${e.message}`)
      return job.error('404', `Unable to find the student folder ${e.message}`)
    }
  } catch (e: any) {
    console.error(`Failed to get an Alfresco ticket on ${alfrescoBaseURL}. Error was ${e.message}`)
    return job.error('504', `Unable to get an Alfresco ticket. ${e.message}`)
  }
}

export const startWorker = () => {
  console.log(`starting phd-assess-ged version ${version}...`)
  console.log("starting worker...")

  const worker = zBClient.createWorker({
    taskType: taskType,
    maxJobsToActivate: 5,
    // Set timeout, the same as we will ask yourself if the job is still up
    timeout: Duration.minutes.of(2),
    // load every job into the in-memory server db
    taskHandler: handler
  })

  console.log(`worker started, awaiting for ${taskType} jobs...`)
  return worker
}
