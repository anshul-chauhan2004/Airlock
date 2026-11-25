import { getApp, getApps, initializeApp } from 'firebase/app'
import { CustomProvider, initializeAppCheck } from 'firebase/app-check'
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, Schema } from 'firebase/ai'
import { isExtension } from './extension'
import { defaultSettings } from './settings'

export const sample = 'Maya Rao from Pine Harbor Studio called +1 202-555-0147 about an invoice for $480.'
export const cloudSample = '[PERSON_1] from [ORG_1] called [PHONE_1] about an invoice for [AMOUNT_1].'
export const entityTypes = ['person', 'organization', 'phone', 'amount', 'email', 'address', 'identifier']

export function firebaseApp() {
  if (!isExtension && (!import.meta.env.DEV || location.hostname !== 'localhost')) {
    throw new Error('Open the unpacked extension or the localhost development app.')
  }
  if (getApps().length) return getApp()
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
  if (Object.values(config).some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Firebase is not configured. Copy .env.example to .env.local, add your Firebase web app settings, and rebuild Airlock.')
  }
  const app = initializeApp(config)
  Object.assign(self, { FIREBASE_APPCHECK_DEBUG_TOKEN: true })
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => { throw new Error('Register this browser’s App Check debug token in Firebase.') },
    }),
  })
  return app
}

export function createModels(cloudModel = defaultSettings.cloudModel) {
  const ai = getAI(firebaseApp(), { backend: new GoogleAIBackend() })
  const entitySchema = Schema.object({
    properties: {
      entities: Schema.array({
        items: Schema.object({
          properties: { text: Schema.string(), type: Schema.enumString({ enum: entityTypes }) },
        }),
      }),
    },
  })
  const checklistSchema = Schema.object({
    properties: {
      items: Schema.array({
        items: Schema.object({
          properties: { action: Schema.string(), evidence: Schema.string() },
        }),
      }),
    },
  })
  const questionSchema = Schema.object({
    properties: {
      answer: Schema.string(),
      evidence: Schema.array({ items: Schema.string() }),
    },
  })

  function createDetector(signal?: AbortSignal) {
    // Firebase forwards these prompt options to Chrome's native Prompt API.
    const promptOptions = { responseConstraint: entitySchema, signal }
    return getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: 'text', languages: ['en'] }],
          expectedOutputs: [{ type: 'text', languages: ['en'] }],
          signal,
        },
        promptOptions,
      },
    })
  }
  const detector = createDetector()
  function analysisModels(mode: InferenceMode) {
    const inCloudParams = { model: cloudModel }
    return {
      reasoner: getGenerativeModel(ai, { mode, inCloudParams }),
      checklist: getGenerativeModel(ai, {
        mode,
        inCloudParams: {
          ...inCloudParams,
          generationConfig: { responseMimeType: 'application/json', responseSchema: checklistSchema },
        },
        onDeviceParams: { promptOptions: { responseConstraint: checklistSchema } },
      }),
      question: getGenerativeModel(ai, {
        mode,
        inCloudParams: {
          ...inCloudParams,
          generationConfig: { responseMimeType: 'application/json', responseSchema: questionSchema },
        },
        onDeviceParams: { promptOptions: { responseConstraint: questionSchema } },
      }),
    }
  }
  return {
    detector,
    createDetector,
    hybrid: analysisModels(InferenceMode.PREFER_IN_CLOUD),
    cloudDiagnostic: getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model: cloudModel } }),
  }
}
