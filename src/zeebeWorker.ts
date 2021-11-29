import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'
import {decryptVariables, encrypt} from "./encryption";
import {flatPick} from "./utils";
import {
  alfrescoBaseURL,
  fetchTicket,
  getStudentFolderURL,
  readFolder,
  uploadPDF
} from "./ged-connector";

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

  const buildStudentName = (jobVariables: any) => {
    if (jobVariables.phdStudentFirstName && jobVariables.phdStudentLastName) {
      return `${jobVariables.phdStudentLastName}, ${jobVariables.phdStudentFirstName}`
    } else {
      return jobVariables.phdStudentName
    }
  }
  const phdStudentName = buildStudentName(jobVariables)

  const phdStudentSciper = jobVariables.phdStudentSciper
  const doctoralID = jobVariables.doctoralProgramName

  const pdfFileName = `Rapport annuel doctorat.pdf`
  const base64String = jobVariables.PDF
  const pdfFile = Buffer.from(base64String, 'base64')

  try {
    // first always get a new ticket for incoming operations or fail trying
    const ticket = await fetchTicket()
    // build the student URL
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
        phdStudentSciper,
        doctoralID,
        ticket)

    // check if the awaited student folder exists
    try {
      await readFolder(alfrescoStudentsFolderURL)
      // ok, looks fine, now try to deposit the pdf
      try {
        await uploadPDF(
            alfrescoStudentsFolderURL,
            pdfFileName, pdfFile
        )

        console.log(`Successfully uploaded the ${pdfFileName} for ${phdStudentName} (${phdStudentSciper}) into ${alfrescoStudentsFolderURL}`)

        const updateBrokerVariables = {
          gedDepositedDate: encrypt(new Date().toISOString()),
        }

        return job.complete(updateBrokerVariables)
      } catch (e: any) {
        console.log(`Unable to send the PDF file into ${alfrescoStudentsFolderURL}. Error was : ${e.message}`)
        return job.error('504', `Unable to upload the PDF. ${e.message}`)
      }
    } catch (e: any) {
      console.error(`Failed to read the student folder ${alfrescoStudentsFolderURL}. Erroring was ${e.message}`)
      return job.error('404', `Unable to find the student folder${alfrescoStudentsFolderURL}. ${e.message}`)
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
