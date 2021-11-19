import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'
import {decryptVariables, encrypt} from "./encryption";
import {flatPick} from "./utils";
import {readFolder, uploadPDF} from "./ged-connector";

const version = require('./version.js');

const debug = debug_('phd-assess/zeebeWorker')

export const zBClient = new ZBClient({
  pollInterval: Duration.seconds.of(10),
})

const taskType = process.env.ZEEBE_TASK_TYPE ? process.env.ZEEBE_TASK_TYPE : ''

const handler: ZBWorkerTaskHandler = async (
  job,
  _,
  worker
) => {
  worker.debug(`Task variables ${job.variables}`)
  debug(`Job "${taskType}" started`);

  console.log("Received and starting task", {
    taskType,
    job: flatPick(job,
      [
        'key',
        'workflowInstanceKey',
        'workflowDefinitionVersion',
        'elementId',
        'worker',
        'variables.created_at',
        'variables.created_by',
      ]
    )
  })

  const jobVariables = decryptVariables(job)

  const phdStudentName = jobVariables.phdStudentName
  const phdStudentSciper = jobVariables.phdStudentSciper
  const doctoratID = jobVariables.doctoralProgramName

  const pdfFileName = `Rapport annuel doctorat.pdf`
  const base64String = jobVariables.PDF
  const pdfFile = Buffer.from(base64String, 'base64')

  // check first if the awaited student folder exists
  try {
    await readFolder(phdStudentName, phdStudentSciper, doctoratID)

    // ok, looks fine, now try to deposit the pdf
    try {
      await uploadPDF(
        phdStudentName, phdStudentSciper, doctoratID,
        pdfFileName, pdfFile
      )

      console.log(`Job is complete, ...`);

      const updateBrokerVariables = {
        gedDepositedDate: encrypt(new Date().toISOString()),
      }

      return job.complete(updateBrokerVariables)

    } catch (e: any) {
      return job.error('504', `Unable to deposit the PDF: GED unreachable. ${e.message}`)
    }
  } catch (e: any) {
    return job.error('404', `Unable to deposit the PDF: Student folder does not exist. ${e.message}`)
  }
}

export const startWorker = () => {
  console.log(`starting phd-assess-pdf version ${version}...`)
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
