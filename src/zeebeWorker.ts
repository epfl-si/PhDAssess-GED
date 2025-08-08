import {ZBClient} from "zeebe-node";
import {Duration, ZBWorkerTaskHandler} from 'zeebe-node'
import debug_ from 'debug'
import {decryptVariables, encrypt} from "./encryption";
import {flatPick, mergePDFs} from "./utils";

import {
  AlfrescoInfo,
  StudentInfo,
  buildStudentName,
  fetchTicket,
  readFolder,
  uploadPDF,
  fetchFileAsBase64
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
        'variables.pdfAnnexPath',
      ]
    ),
    hasPDFAnnexPath: !!job.variables.pdfAnnexPath,
  })

  const jobVariables = decryptVariables(job, alreadyDecryptedVariables)

  const studentInfo: StudentInfo = {
    doctoralAcronym: jobVariables.doctoralProgramName ?? '',
    studentName: buildStudentName(jobVariables),
    sciper:jobVariables.phdStudentSciper ?? '',
  }

  const getPDFName = () => {
    const date = new Date()
    return `Rapport annuel doctorat ${date.toISOString().slice(0,10)}.pdf`
  }

  const pdfFileName = getPDFName()

  const alfrescoInfo: AlfrescoInfo = {
    serverUrl: process.env.ALFRESCO_URL!,
    username: process.env.ALFRESCO_USERNAME!,
    password: process.env.ALFRESCO_PASSWORD!,
  }

  try {

    // first get a new ticket for incoming operations or fail trying
    const ticket = await fetchTicket(alfrescoInfo)

    // check if the awaited student folder exists
    await readFolder(
      alfrescoInfo,
      studentInfo,
      ticket
    )

    let generatedPDF = jobVariables.PDF ?? ''

    // check the need to download an annex before pushing the provided PDF
    if (generatedPDF && jobVariables.pdfAnnexPath) {
      const pdfAnnexAsBase64 = await fetchFileAsBase64(
        jobVariables.pdfAnnexPath,
        ticket,
      )
      // merge the two
      generatedPDF = await mergePDFs(generatedPDF, pdfAnnexAsBase64)
    }

    const pdfFullPath = await uploadPDF(
      alfrescoInfo,
      studentInfo,
      ticket,
      pdfFileName,
      Buffer.from(generatedPDF, 'base64')
    ) as string

    console.log(`Successfully uploaded the ${ pdfFullPath } for student (${ studentInfo.sciper })`)

    const updateBrokerVariables = {
      gedDepositedDate: encrypt(new Date().toISOString()),
    }

    return job.complete(updateBrokerVariables)

  } catch (e: any) {
    console.error(
      `Failed to push the PDF into Alfresco on ${alfrescoInfo.serverUrl} for process instance ${ job.processInstanceKey }. ` +
      `Error was ${e.message}`
    )
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
