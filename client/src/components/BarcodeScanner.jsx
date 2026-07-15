import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { Modal, Spinner } from './ui'

// Open Food Facts is the one external API the brief allows — barcode → product name.
async function lookupProductName(barcode) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1) return null
    const { product_name: name, brands } = data.product || {}
    if (!name) return null
    return brands ? `${name} (${brands.split(',')[0].trim()})` : name
  } catch {
    return null // Offline or blocked — the user can still type the name.
  }
}

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Point your camera at a barcode')
  const [looking, setLooking] = useState(false)

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(null, videoRef.current, async (result) => {
        if (cancelled || !result) return

        // Stop first: the callback keeps firing on every frame otherwise.
        reader.reset()
        const barcode = result.getText()
        setLooking(true)
        setStatus(`Found ${barcode} — looking up product…`)

        const name = await lookupProductName(barcode)
        if (cancelled) return
        onDetected({ barcode, name })
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access or enter the item by hand.'
            : 'No camera available on this device. Enter the item by hand instead.',
        )
      })

    return () => {
      cancelled = true
      reader.reset()
    }
  }, [onDetected])

  return (
    <Modal title="Scan barcode" onClose={onClose}>
      {error ? (
        <div className="alert error">{error}</div>
      ) : (
        <>
          <div className="scanner-view">
            <video ref={videoRef} muted playsInline />
            <div className="scanner-reticle" />
          </div>
          <p
            style={{
              marginTop: 12,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {looking && <Spinner />}
            {status}
          </p>
        </>
      )}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
