"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, type, onFocus, ...props }, ref) => {
    const inputId = id ?? props.name

    // For numeric inputs, select the existing value on focus so the user
    // doesn't have to manually delete the placeholder "0" before typing.
    // Custom onFocus handlers from callers still run after.
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (type === "number") {
        // Some browsers throw on .select() for non-text-like inputs; guard it.
        try { e.target.select() } catch {}
      }
      onFocus?.(e)
    }

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm text-gray-300 font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          onFocus={handleFocus}
          className={cn(
            "w-full h-10 px-3 bg-gray-800 border rounded-lg text-white text-sm",
            "placeholder:text-gray-500",
            "transition-colors duration-150",
            "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
            error ? "border-red-500" : "border-gray-700",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : hint ? (
          <p className="text-xs text-gray-500">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = "Input"
