"use client"

import { useId, useRef, useState, type DragEvent } from "react"
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageDropzoneProps {
  /** Currently stored image URL (already uploaded), shown as a preview. */
  value?: string | null
  /** Called with the picked file when the user selects or drops an image. */
  onFile: (file: File) => void
  /** When provided and a value exists, shows a remove (trash) button. */
  onRemove?: () => void
  label: string
  description?: string
  /** Shows the loading overlay while an upload is in flight. */
  uploading?: boolean
  disabled?: boolean
  /** Aspect-ratio hint for the preview frame. Defaults to a wide-ish box. */
  className?: string
  accept?: string
}

export function ImageDropzone({
  value,
  onFile,
  onRemove,
  label,
  description,
  uploading = false,
  disabled = false,
  className,
  accept = "image/*",
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [isDragging, setIsDragging] = useState(false)

  const openPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled || uploading) return
    const file = event.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) onFile(file)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!disabled && !uploading) setIsDragging(true)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand transition-colors hover:text-brand-2"
            onClick={(event) => event.stopPropagation()}
          >
            Ver actual
          </a>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Subir ${label.toLowerCase()}`}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPicker()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          "group relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-input/40 p-4 text-center transition-all",
          "hover:border-brand/50 hover:bg-input/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          isDragging && "border-brand bg-brand/10 ring-brand-glow",
          (disabled || uploading) && "cursor-not-allowed opacity-70",
        )}
      >
        {value ? (
          <>
            {onRemove ? (
              <button
                type="button"
                aria-label={`Quitar ${label.toLowerCase()}`}
                onClick={(event) => {
                  event.stopPropagation()
                  if (!disabled && !uploading) onRemove()
                }}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <img
              src={value}
              alt={label}
              className="max-h-28 w-auto rounded-md object-contain"
            />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImagePlus className="h-3.5 w-3.5" />
              Click o arrastrá para reemplazar
            </span>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-brand transition-transform group-hover:scale-110">
              <UploadCloud className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">Arrastrá una imagen o hacé click</span>
            {description ? (
              <span className="text-xs text-muted-foreground">{description}</span>
            ) : (
              <span className="text-xs text-muted-foreground">PNG, JPG, WEBP o GIF</span>
            )}
          </>
        )}

        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span className="text-xs text-muted-foreground">Subiendo a Supabase…</span>
          </div>
        ) : null}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
            // allow re-selecting the same file
            event.target.value = ""
          }}
        />
      </div>
    </div>
  )
}
