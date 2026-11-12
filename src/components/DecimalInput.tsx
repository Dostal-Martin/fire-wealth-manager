import { useEffect, useRef, useState } from 'react'

type DecimalInputProps = {
  value: number
  onValueChange: (value: number) => void
  required?: boolean
  readOnly?: boolean
  disabled?: boolean
  allowNegative?: boolean
  decimalPlaces?: number
  placeholder?: string
  className?: string
}

function toEditable(value: number, decimalPlaces: number) {
  if (!Number.isFinite(value) || value === 0) return ''
  return Number(value.toFixed(decimalPlaces)).toString().replace('.', ',')
}

function parseLocalized(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '')
    .replace(',', '.')

  if (normalized === '' || normalized === '-' || normalized.endsWith('.')) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export default function DecimalInput({
  value,
  onValueChange,
  required = false,
  readOnly = false,
  disabled = false,
  allowNegative = false,
  decimalPlaces = 2,
  placeholder,
  className = 'form-control',
}: DecimalInputProps) {
  const [text, setText] = useState(() => toEditable(value, decimalPlaces))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(toEditable(value, decimalPlaces))
  }, [value, decimalPlaces])

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true }}
      onChange={(event) => {
        const next = event.target.value
        if (!allowNegative && next.includes('-')) return
        if (!/^-?[0-9\s]*([,.][0-9]*)?$/.test(next)) return

        setText(next)
        const parsed = parseLocalized(next)
        if (parsed !== null) onValueChange(parsed)
        if (next.trim() === '') onValueChange(0)
      }}
      onBlur={() => {
        focused.current = false
        const parsed = parseLocalized(text)
        const normalized = parsed ?? 0
        onValueChange(normalized)
        setText(toEditable(normalized, decimalPlaces))
      }}
    />
  )
}
