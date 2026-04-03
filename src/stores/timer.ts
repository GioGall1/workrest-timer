import { defineStore } from 'pinia'

export type Phase = 'idle' | 'work' | 'rest' | 'done'

interface Cfg {
  totalHours: number
  workMin: number
  restMin: number
  snoozeMin: number
}

const CFG_STORAGE_KEY = 'workrest_cfg'
const DEFAULT_CFG: Cfg = { totalHours: 5, workMin: 40, restMin: 20, snoozeMin: 5 }

function clampFiniteNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeCfg(input: unknown): Cfg {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    // allow fractional hours but keep reasonable bounds
    totalHours: clampFiniteNumber(o.totalHours, 1, 24, DEFAULT_CFG.totalHours),
    // minute values should be integers
    workMin: Math.round(clampFiniteNumber(o.workMin, 1, 240, DEFAULT_CFG.workMin)),
    restMin: Math.round(clampFiniteNumber(o.restMin, 1, 240, DEFAULT_CFG.restMin)),
    snoozeMin: Math.round(clampFiniteNumber(o.snoozeMin, 1, 120, DEFAULT_CFG.snoozeMin)),
  }
}

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export const useTimerStore = defineStore('timer', {
  state: () => ({
    cfg: { ...DEFAULT_CFG } as Cfg,
    phase: 'idle' as Phase,
    cycleIndex: 0,
    targetTs: 0,
    workedMs: 0,
    autoNextHandle: 0 as number | 0,
    autoNextAt: 0,
    autoNextTickHandle: 0 as number | 0,

    // показываем «Отложить / Продолжить фазу», когда фаза закончилась
    awaitingAction: false,

    nowTs: Date.now(),
    phaseDurationMs: 0,

    isPaused: false,
    pausedRemainingMs: 0,

    tickHandle: 0 as number | 0,
  }),
  getters: {
    // Общая цель рабочей сессии (в мс)
    totalWorkMs: (s) => s.cfg.totalHours * 60 * 60 * 1000,
  
    // Остаток времени до конца ТЕКУЩЕЙ фазы
    // При паузе используем зафиксированное значение
    remainingMs(): number {
      return this.isPaused
        ? this.pausedRemainingMs
        : Math.max(0, this.targetTs - this.nowTs)
    },
  
    // Идёт ли сейчас активная фаза (work/rest)
    isRunning: (s) => s.phase === 'work' || s.phase === 'rest',
  
    // Прогресс ТЕКУЩЕЙ фазы (0..1) — для локальной полосы
    phaseProgress(): number {
      if (!this.phaseDurationMs) return 0
      const elapsed = Math.max(0, this.phaseDurationMs - this.remainingMs)
      return Math.min(1, elapsed / this.phaseDurationMs)
    },
  
    // --- ГЕТТЕРЫ ДЛЯ ГЛОБАЛЬНОГО ПРОГРЕССА ---
  
    elapsedInPhaseMs(): number {
      if (!this.phaseDurationMs) return 0
      const rem = this.isPaused
        ? Math.max(0, this.pausedRemainingMs)
        : Math.max(0, this.targetTs - this.nowTs)
      const elapsed = Math.max(0, this.phaseDurationMs - rem)
      return Math.min(this.phaseDurationMs, elapsed)
    },
  
    overallWorkedMs(): number {
      const current = this.phase === 'work' ? this.elapsedInPhaseMs : 0
      return Math.min(this.workedMs + current, this.totalWorkMs)
    },
  
    overallProgress(): number {
      const total = this.totalWorkMs || 1
      if (this.phase === 'idle') return 0
      if (this.phase === 'done') return 1
      return Math.min(1, this.overallWorkedMs / total)
    },

    autoNextSeconds(): number {
      if (!this.awaitingAction || !this.autoNextAt) return 0
      return Math.max(0, Math.ceil((this.autoNextAt - this.nowTs) / 1000))
    },
  },
  
  actions: {
    configure(partial: Partial<Cfg>) {
      this.cfg = normalizeCfg({ ...this.cfg, ...partial })
      safeStorageSet(CFG_STORAGE_KEY, JSON.stringify(this.cfg))
    },
    restore() {
      const raw = safeStorageGet(CFG_STORAGE_KEY)
      if (!raw) return
      try {
        this.cfg = normalizeCfg(JSON.parse(raw))
      } catch {
        this.cfg = { ...DEFAULT_CFG }
      }
    },
    async ensurePermission() {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission()
      }
    },
 // ===== Public API (то, что дергает UI) =====
    start() {
      void this.ensurePermission()
      if (this.phase === 'done') this.reset()

      if (this.awaitingAction) return

      if (this.phase === 'idle') {
        this._enter('work')
      } else if (this.isPaused) {
        this.targetTs = Date.now() + this.pausedRemainingMs
        this.isPaused = false
      }

      this._startTick()
    },

    pause() {
      if (this.awaitingAction || !this.isRunning || this.isPaused) return
      const left = Math.max(0, this.targetTs - this.nowTs)
      this.isPaused = true
      this.pausedRemainingMs = left
      this.targetTs = this.nowTs + left
      this._stopTick()
    },

    reset() {
      this._stopAutoNext()
      this.phase = 'idle'
      this.cycleIndex = 0
      this.workedMs = 0

      this.awaitingAction = false
      this.isPaused = false
      this.pausedRemainingMs = 0

      this.phaseDurationMs = 0
      this.targetTs = 0
      this.nowTs = Date.now()

      this._stopTick()
    },

    skip() {
      if (this.phase === 'work') {
        this.workedMs = Math.min(
          this.totalWorkMs,
          this.workedMs + this.elapsedInPhaseMs
        )
      }

      this.awaitingAction = false
      this.isPaused = false
      this.pausedRemainingMs = 0
  
      if (this.phase === 'work') {
        this._enter('rest')
      } else if (this.phase === 'rest') {
        this._enter('work')
      }
  
      this._startTick()
    },

    completePhase() {
      this._stopAutoNext()
      if (!this.awaitingAction) return     
      this.awaitingAction = false
      this._enter(this.phase)
      this._startTick()
    },

    goNextPhase() {

        this._stopAutoNext()

      if (this.phase === 'work') {
        this.workedMs = Math.min(
          this.totalWorkMs,
          this.workedMs + this.elapsedInPhaseMs
        )
        if (this.workedMs >= this.totalWorkMs) {
          this.phase = 'done'
          this._notify('Сессия завершена')
          this._stopTick()
          this.awaitingAction = false
          return
        }
        this._enter('rest')
      } else if (this.phase === 'rest') {
        this._enter('work')
      }
      this.awaitingAction = false
      this._startTick()
    },
  
    snooze() {
      const add = this.cfg.snoozeMin * 60 * 1000
      this._stopAutoNext()

      if (this.isPaused) {
        this.pausedRemainingMs += add
        this.phaseDurationMs += add
        this._notify(`Отложено на ${this.cfg.snoozeMin} мин.`)
        return
      }

      if (this.awaitingAction) {
        this.targetTs = Date.now() + add
        this.phaseDurationMs += add
        this.awaitingAction = false
        this._notify(`Отложено на ${this.cfg.snoozeMin} мин.`)
        this._startTick()
        return
      }

      if (this.isRunning) {
        this.targetTs += add
        this.phaseDurationMs += add
        this._notify(`Отложено на ${this.cfg.snoozeMin} мин.`)
      }
    },

  // ===== Auto logic =====

      _startAutoNext() {
      this._stopAutoNext()

      const delay = 20_000
      this.autoNextAt = Date.now() + delay

      // тик для обновления nowTs, чтобы UI видел обратный отсчёт
      const tick = () => {
        this.nowTs = Date.now()
        if (!this.awaitingAction) return
        this.autoNextTickHandle = window.setTimeout(tick, 250)
      }
      tick()

      this.autoNextHandle = window.setTimeout(() => {
        if (this.awaitingAction) {
          this.goNextPhase()
        }
      }, delay)
    },

    _stopAutoNext() {
      if (this.autoNextHandle) {
        clearTimeout(this.autoNextHandle)
        this.autoNextHandle = 0
      }
      if (this.autoNextTickHandle) {
        clearTimeout(this.autoNextTickHandle)
        this.autoNextTickHandle = 0
      }
      this.autoNextAt = 0
    },

 // ===== Phase lifecycle ===== 

    _enter(to: Phase) {
      const { workMin, restMin } = this.cfg
      this.awaitingAction = false
      this.isPaused = false
      this.pausedRemainingMs = 0

      this.phase = to
      const durMin = to === 'work' ? workMin : restMin
      this.phaseDurationMs = durMin * 60 * 1000
      this.targetTs = Date.now() + this.phaseDurationMs

      if (to !== 'idle' && to !== 'done')
        this._notify(to === 'work' ? 'Работа началась' : 'Отдых начался')
    },

    _startTick() {
      if (this.tickHandle) return
      const loop = () => {
        this.nowTs = Date.now()

        if (this.remainingMs <= 0) {
          this.awaitingAction = true
          this._notify(
            this.phase === 'work'
              ? 'Работа завершена — продолжить или отложить?'
              : 'Отдых завершён — продолжить или отложить?'
          )
          this._stopTick()
          this._startAutoNext()
          return
        }

        this.tickHandle = window.setTimeout(loop, 100)
      }
      loop()
    },

    _stopTick() {
      if (this.tickHandle) {
        clearTimeout(this.tickHandle)
        this.tickHandle = 0
      }
    },

    _notify(body: string) {
      try {
        if (!('Notification' in window)) return
        if (Notification.permission === 'granted')
          new Notification('WorkRest Timer', { body })
      } catch {}
    },
  },
})
