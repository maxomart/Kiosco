"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  SHORTCUT_ACTIONS,
  getShortcutMap,
  eventToCombo,
  isEditableFocused,
  type ShortcutAction,
} from "@/lib/shortcuts"

export type ShortcutHandlers = Partial<Record<string, () => void>>

/**
 * Hook: registers global keyboard shortcuts based on the user's configured map.
 * Pass a handlers object keyed by action ID.
 *
 * Example:
 *   useShortcuts({
 *     "pos:search": () => searchInputRef.current?.focus(),
 *     "pos:charge": () => handleCharge(),
 *   })
 */
export function useShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const mapRef = useRef<Record<string, string>>({})
  const [, forceUpdate] = useState({})

  // Load the map once (client-side only)
  useEffect(() => {
    mapRef.current = getShortcutMap()
    forceUpdate({})
    // Listen for external updates (e.g. after saving from config page)
    const handler = () => {
      mapRef.current = getShortcutMap()
      forceUpdate({})
    }
    window.addEventListener("shortcuts:updated", handler)
    return () => window.removeEventListener("shortcuts:updated", handler)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      const combo = eventToCombo(e)
      const editable = isEditableFocused()

      // Find any action whose configured combo matches this event
      for (const action of SHORTCUT_ACTIONS) {
        const configured = mapRef.current[action.id] ?? action.defaultKey
        if (combo !== configured) continue
        // If editable is focused, only trigger if the action explicitly allows it
        if (editable && !action.captureInInput) continue
        const fn = handlers[action.id]
        if (fn) {
          e.preventDefault()
          fn()
        }
        return // one combo can only trigger one action
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlers, enabled])
}

/** Returns the current user-configured key for an action. */
export function useShortcutKey(actionId: string): string {
  const [key, setKey] = useState<string>(() => {
    const a = SHORTCUT_ACTIONS.find((a) => a.id === actionId)
    return a?.defaultKey ?? ""
  })
  useEffect(() => {
    const update = () => {
      const map = getShortcutMap()
      setKey(map[actionId] ?? "")
    }
    update()
    window.addEventListener("shortcuts:updated", update)
    return () => window.removeEventListener("shortcuts:updated", update)
  }, [actionId])
  return key
}
