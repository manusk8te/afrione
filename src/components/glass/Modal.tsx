'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

type Action = {
  label: string
  onClick?: () => void
  /** Ferme la modale après le clic (par défaut : oui pour le secondaire). */
  closes?: boolean
}

export type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  icon?: ReactNode
  children?: ReactNode
  primaryAction?: Action
  secondaryAction?: Action
  /** Libellé accessible du bouton fermer. */
  closeLabel?: string
}

const SPRING = { type: 'spring', stiffness: 300, damping: 28 } as const
const EXIT = { duration: 0.14, ease: [0.4, 0, 1, 1] } as const

/**
 * Modal Liquid Glass.
 * Radix gère le piège de focus, Échap, le clic à l'extérieur, aria-labelledby /
 * aria-describedby et le retour du focus sur le déclencheur.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  primaryAction,
  secondaryAction,
  closeLabel = 'Fermer',
}: ModalProps) {
  const reduce = useReducedMotion()

  // Radix ne rend le focus qu'à un <Dialog.Trigger>. Ici la modale est pilotée
  // par `open`, donc on mémorise l'élément actif au moment où elle s'ouvre
  // (pendant le rendu, avant que Radix ne déplace le focus) et on le restaure.
  const returnTo = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    returnTo.current = document.activeElement as HTMLElement | null
  }
  wasOpen.current = open

  const restoreFocus = (e: Event) => {
    const el = returnTo.current
    if (el && el.isConnected && el !== document.body) {
      e.preventDefault()
      el.focus({ preventScroll: true })
    }
  }

  const panel = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.94, y: 12 },
        animate: { opacity: 1, scale: 1, y: 0, transition: SPRING },
        exit: { opacity: 0, scale: 0.97, y: 6, transition: EXIT },
      }

  const run = (action: Action | undefined, closeByDefault: boolean) => () => {
    action?.onClick?.()
    if (action?.closes ?? closeByDefault) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="lg-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: reduce ? 0.12 : 0.2 } }}
                exit={{ opacity: 0, transition: EXIT }}
              />
            </Dialog.Overlay>

            <div className="lg-modal-viewport liquid">
              <Dialog.Content asChild forceMount aria-modal="true" onCloseAutoFocus={restoreFocus} {...(description ? {} : { 'aria-describedby': undefined })}>
                <motion.div className="lg-modal glass glass--strong" {...panel}>
                  <Dialog.Close className="lg-icon-btn lg-modal__close" aria-label={closeLabel}>
                    <X size={18} aria-hidden="true" />
                  </Dialog.Close>

                  {icon && (
                    <div className="lg-modal__icon glass glass--subtle" aria-hidden="true">
                      {icon}
                    </div>
                  )}

                  <Dialog.Title className="lg-modal__title">{title}</Dialog.Title>
                  {description && (
                    <Dialog.Description className="lg-modal__description">{description}</Dialog.Description>
                  )}

                  {children && <div className="lg-modal__body">{children}</div>}

                  {(primaryAction || secondaryAction) && (
                    <div className="lg-modal__footer">
                      {secondaryAction && (
                        <button type="button" className="lg-btn lg-btn--glass" onClick={run(secondaryAction, true)}>
                          {secondaryAction.label}
                        </button>
                      )}
                      {primaryAction && (
                        <button type="button" className="lg-btn lg-btn--primary" onClick={run(primaryAction, false)}>
                          {primaryAction.label}
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

export default Modal
