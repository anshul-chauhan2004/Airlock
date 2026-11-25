import type { FirebaseApp } from 'firebase/app'
import { fetchAndActivate, getRemoteConfig, getString, isSupported } from 'firebase/remote-config'

export const defaultSettings = {
  cloudModel: 'gemini-3.5-flash-lite',
  documentLimit: 12_000,
}

export async function fetchSettings(app: FirebaseApp) {
  if (!await isSupported()) throw new Error('Remote settings are unavailable in this browser. Defaults remain active.')
  const config = getRemoteConfig(app)
  config.defaultConfig = {
    airlock_cloud_model: defaultSettings.cloudModel,
    airlock_document_limit: defaultSettings.documentLimit,
  }
  config.settings.fetchTimeoutMillis = 5000
  config.settings.minimumFetchIntervalMillis = 60 * 60 * 1000
  await fetchAndActivate(config)
  const cloudModel = getString(config, 'airlock_cloud_model')
  const limit = Number(getString(config, 'airlock_document_limit'))
  if (!/^gemini-[a-z0-9.-]+$/.test(cloudModel) ||
      !Number.isInteger(limit) || limit < 1000 || limit > 12_000) {
    throw new Error('Remote settings contain unsupported values. Defaults remain active.')
  }
  return { cloudModel, documentLimit: limit }
}
