import { defineStore } from 'pinia'

export type Phase = 'idle' | 'work' | 'rest' | 'done'

interface Cfg {
  totalHours: number
  workMin: number
  restMin: number
  snoozeMin: number
}

export const useTimerStore = defineStore('timer', {
  state: () => ({
    cfg: { totalHours: 5, workMin: 40, restMin: 20, snoozeMin: 5 } as Cfg,
    phase: 'idle' as Phase,
    cycleIndex: 0,
    targetTs: 0,
    workedMs: 0,

    nowTs: Date.now(),
    phaseDurationMs: 0,

    isPaused: false,
    pausedRemainingMs: 0,

    tickHandle: 0 as number | 0,
  }),
  getters: {
    totalWorkMs: (s) => s.cfg.totalHours * 60 * 60 * 1000,
    remainingMs(): number {
      return Math.max(0, this.targetTs - this.nowTs)
    },
    isRunning:   (s) => s.phase === 'work' || s.phase === 'rest',
    phaseProgress(): number {
      if (!this.phaseDurationMs) return 0
      const elapsed = Math.max(0, this.phaseDurationMs - this.remainingMs)
      return Math.min(1, elapsed / this.phaseDurationMs)
    },
  },
  actions: {
    configure(partial: Partial<Cfg>) {
      this.cfg = { ...this.cfg, ...partial }
      localStorage.setItem('workrest_cfg', JSON.stringify(this.cfg))
    },
    restore() {
      const raw = localStorage.getItem('workrest_cfg')
      if (raw) this.cfg = JSON.parse(raw)
    },
    async ensurePermission() {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission()
      }
    },
    start() {
      if (this.phase === 'done') this.reset()
        
      if (this.phase === 'idle') {
        this._enter('work')
      } else if (this.isPaused) {
        this.targetTs = Date.now() + this.pausedRemainingMs
        this.isPaused = false
      }

      this._startTick()
    },
    pause() { 
      if(!this.isRunning || this.isPaused) return
      this.isPaused = true
      this.pausedRemainingMs = this.remainingMs
      this._stopTick() 
    },
    reset() {
      this.phase = 'idle'
      this.cycleIndex = 0
      this.workedMs = 0
      this.isPaused = false
      this.pausedRemainingMs = 0
      this._stopTick()
    },
    skip() {
      this.isPaused = false
      this.pausedRemainingMs = 0
      if (this.phase === 'work') this._enter('rest')
      else if (this.phase === 'rest') this._enter('work')
      this._startTick()
    },
    snooze() {
      const add = this.cfg.snoozeMin * 60 * 1000
      if (this.isPaused) {
        this.pausedRemainingMs += add
      } else if (this.isRunning) {
        this.targetTs += add
      } else {
        return
      }
      this.targetTs += add
      this.phaseDurationMs += add
      this._notify(`Отложено на ${this.cfg.snoozeMin} мин.`)
    },

    // внутреннее
    _enter(to: Phase) {
      const { workMin, restMin } = this.cfg
      this.phase = to
      const durMin = to === 'work' ? workMin : restMin
      this.phaseDurationMs = durMin * 60 * 1000
      this.targetTs = Date.now() + this.phaseDurationMs
      if (to !== 'idle' && to !== 'done') 
        this._notify(to === 'work' ? 'Работа началась' : 'Отдых начался')
    },
    _notify(body: string) {
      try {
        if (!('Notification' in window)) return
        if (Notification.permission === 'granted') new Notification('WorkRest Timer', { body })
      } catch {}
    },
    _startTick() {
      if (this.tickHandle) return
      const loop = () => {
          this.nowTs = Date.now()

        if (this.remainingMs <= 0) {
          if (this.phase === 'work') {
            this.workedMs += this.cfg.workMin * 60 * 1000
            if (this.workedMs >= this.totalWorkMs) {
              this.phase = 'done'
              this._notify('Сессия завершена')
              this._stopTick()
              return
            }
            this._enter('rest')
          } else if (this.phase === 'rest') {
            this._enter('work')
          }
        }
        this.tickHandle = window.setTimeout(loop, 100)
      }
      loop()
    },
    _stopTick() {
      if (this.tickHandle) { clearTimeout(this.tickHandle); this.tickHandle = 0 }
    },
  }
})