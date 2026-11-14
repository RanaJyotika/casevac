"use client";

import { useId, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/** Longest side of the stored photo, in px. Small on purpose: it travels to tablets. */
const MAX_SIDE = 240;
const JPEG_QUALITY = 0.72;

/**
 * Optional ID photo. The image is shrunk in the browser to a small JPEG and
 * submitted as a data URL in a hidden field — the original file never leaves
 * this computer. Shown to medics on the tablet; never put in the QR.
 */
export function PhotoField({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  const [photo, setPhoto] = useState(defaultValue ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const choose = async (file: File | undefined) => {
    setProblem(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProblem("Choose an image file (JPEG or PNG).");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setPhoto(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    } catch {
      setProblem("This image could not be read. Try another file.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const message = problem ?? error;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-[13px] font-medium" id={`${id}-label`}>
        ID photo <span className="font-normal text-muted">(optional)</span>
      </span>
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-canvas">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={photo} alt="Selected ID photo" className="size-full object-cover" />
          ) : (
            <Camera className="size-7 text-muted" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label htmlFor={`${id}-file`} className={buttonClasses("secondary", "sm", "cursor-pointer")}>
              <Camera className="size-4" aria-hidden /> {photo ? "Replace photo" : "Add photo"}
            </label>
            {photo ? (
              <button type="button" className={buttonClasses("ghost", "sm")} onClick={() => setPhoto("")}>
                <Trash2 className="size-4" aria-hidden /> Remove
              </button>
            ) : null}
          </div>
          <span className="text-xs text-muted">Face photo for identification. Resized to {MAX_SIDE} px before saving.</span>
        </div>
      </div>
      <input
        ref={inputRef}
        id={`${id}-file`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-labelledby={`${id}-label`}
        onChange={event => choose(event.target.files?.[0])}
      />
      <input type="hidden" name="photo" value={photo} />
      {message ? <p className="text-xs font-medium text-danger">{message}</p> : null}
    </div>
  );
}
