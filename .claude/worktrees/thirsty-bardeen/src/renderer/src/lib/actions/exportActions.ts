// exportActions.ts — Export-Aktionen
// Ersetzt V1 toolbar.js (exportSequence, exportZip)

import { getVideoPath, getVideoMeta, getScenes, getSelectedIndices, getVisibleScenes } from '../stores'
import { showToast } from './toastManager'
import * as ipc from '../ipc/bridge'
import { EXPORT_CODECS } from '../../../../shared/constants'
import type { ExportCodecKey } from '../../../../shared/models'

/**
 * Video-Dateinamen ohne Extension aus dem Pfad extrahieren
 */
function getVideoBaseName(videoPath: string): string {
  const fileName = videoPath.split('/').pop() ?? videoPath.split('\\').pop() ?? 'video'
  const dotIdx = fileName.lastIndexOf('.')
  return dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName
}

/**
 * Sequenz exportieren — H.264 als Default-Codec
 * Bei selektierten Szenen: nur den ausgewählten Bereich exportieren
 */
export async function exportSequence(): Promise<void> {
  const videoPath = getVideoPath()
  if (!videoPath) {
    showToast('No video loaded', 'warning')
    return
  }

  // Verzeichnis wählen
  const dirResult = await ipc.selectExportDir()
  if (!dirResult.success || !dirResult.path) return

  // Codec bestimmen (H264 als Default — einfachster Ansatz)
  const codecKey: ExportCodecKey = 'H264'
  const codec = EXPORT_CODECS[codecKey]

  // Start/End-Time bestimmen
  const scenes = getScenes()
  const selectedIndices = getSelectedIndices()
  const meta = getVideoMeta()

  let startTime: number
  let endTime: number

  if (selectedIndices.length > 0) {
    // Nur selektierte Szenen exportieren
    const selectedScenes = selectedIndices
      .filter((i) => i >= 0 && i < scenes.length)
      .map((i) => scenes[i])

    if (selectedScenes.length === 0) {
      showToast('Selected scenes not found', 'warning')
      return
    }

    startTime = Math.min(...selectedScenes.map((s) => s.startTime))
    endTime = Math.max(...selectedScenes.map((s) => s.endTime))
  } else {
    // Komplettes Video exportieren
    startTime = 0
    endTime = meta?.data?.duration ?? 0

    if (endTime <= 0) {
      showToast('Video duration unknown', 'warning')
      return
    }
  }

  // Output-Pfad zusammenbauen
  const baseName = getVideoBaseName(videoPath)
  const outputPath = `${dirResult.path}/${baseName}_export${codec.extension}`

  try {
    const result = await ipc.exportSequence({
      videoPath,
      startTime,
      endTime,
      outputPath,
      codec: codecKey,
    })

    if (result.success) {
      showToast(`Export complete: ${outputPath}`, 'success')
    } else {
      showToast(`Export failed: ${result.error ?? 'Unknown error'}`, 'error')
    }
  } catch (err) {
    showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
  }
}

/**
 * ZIP mit Thumbnails exportieren — alle sichtbaren Szenen mit Thumbnail
 */
export async function exportZip(): Promise<void> {
  const scenes = getScenes()
  if (!scenes || scenes.length === 0) {
    showToast('No scenes to export', 'warning')
    return
  }

  // Sichtbare Szenen mit thumbPath sammeln
  const visibleScenes = getVisibleScenes()
  const thumbPaths = visibleScenes
    .map((s) => s.thumbPath)
    .filter((p): p is string => !!p)

  if (thumbPaths.length === 0) {
    showToast('No thumbnails available', 'warning')
    return
  }

  // Verzeichnis wählen
  const dirResult = await ipc.selectExportDir()
  if (!dirResult.success || !dirResult.path) return

  // Output-Pfad zusammenbauen
  const videoPath = getVideoPath()
  const baseName = videoPath ? getVideoBaseName(videoPath) : 'thumbnails'
  const outputPath = `${dirResult.path}/${baseName}_thumbnails.zip`

  try {
    const result = await ipc.exportZip({
      thumbnailPaths: thumbPaths,
      outputPath,
    })

    if (result.success) {
      showToast(`ZIP export complete: ${outputPath}`, 'success')
    } else {
      showToast(`ZIP export failed: ${result.error ?? 'Unknown error'}`, 'error')
    }
  } catch (err) {
    showToast(`ZIP export failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
  }
}
