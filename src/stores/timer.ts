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
  
    // --- НИЖЕ ДОБАВЛЕНЫ НОВЫЕ ГЕТТЕРЫ ДЛЯ ГЛОБАЛЬНОГО ПРОГРЕССА ---
  
    // Сколько прошло в текущей фазе (мс)
    elapsedInPhaseMs(): number {
      if (!this.phaseDurationMs) return 0
      const rem = this.isPaused
        ? Math.max(0, this.pausedRemainingMs)
        : Math.max(0, this.targetTs - this.nowTs)
      const elapsed = Math.max(0, this.phaseDurationMs - rem)
      return Math.min(this.phaseDurationMs, elapsed)
    },
  
    // Общее отработанное время: завершённые «work» + текущая «work» (если идёт)
    overallWorkedMs(): number {
      const current = this.phase === 'work' ? this.elapsedInPhaseMs : 0
      return Math.min(this.workedMs + current, this.totalWorkMs)
    },
  
    // Глобальный прогресс к цели totalWorkMs (0..1)
   overallProgress(): number {
      const total = this.totalWorkMs || 1
      if (this.phase === 'idle' || this.phase === 'done') return 0
      return Math.min(1, this.overallWorkedMs / total)
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

      // если фаза уже закончилась — ждём явного решения (Отложить/Продолжить)
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
      // нельзя ставить паузу, если фаза уже закончилась
      if (this.awaitingAction || !this.isRunning || this.isPaused) return
      const left = Math.max(0, this.targetTs - this.nowTs)
      this.isPaused = true
      this.pausedRemainingMs = left
      this.targetTs = this.nowTs + left
      this._stopTick()
    },

    reset() {
      this.phase = 'idle'
      this.cycleIndex = 0
      this.workedMs = 0

      this.awaitingAction = false
      this.isPaused = false
      this.pausedRemainingMs = 0

      // полностью обнуляем визуально
      this.phaseDurationMs = 0
      this.targetTs = 0
      this.nowTs = Date.now()

      this._stopTick()
    },

    skip() {
      // Если пропускаем во время «work» — докинем уже отработанное в общий прогресс,
      // чтобы глобальная шкала не откатывалась назад.
      if (this.phase === 'work') {
        this.workedMs = Math.min(
          this.totalWorkMs,
          this.workedMs + this.elapsedInPhaseMs
        )
      }
  
      // Сбрасываем служебные флаги и переходим к следующей фазе
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

    // «Продолжить фазу» после нуля (кнопка вместо автоперехода)
    completePhase() {
      if (!this.awaitingAction) return
      // «Продолжить фазу» — повторить текущую фазу заново на полный срок
      this.awaitingAction = false
      this._enter(this.phase)
      this._startTick()
    },

    // «Отложить» — работает в трёх режимах: во время паузы, в ожидании, и во время активной фазы
    snooze() {
      const add = this.cfg.snoozeMin * 60 * 1000

      if (this.isPaused) {
        this.pausedRemainingMs += add
        this.phaseDurationMs += add
        this._notify(`Отложено на ${this.cfg.snoozeMin} мин.`)
        return
      }

      if (this.awaitingAction) {
        // фаза уже закончилась — продлеваем её и снова запускаем тик
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

    // внутреннее
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

    _notify(body: string) {
      try {
        if (!('Notification' in window)) return
        if (Notification.permission === 'granted')
          new Notification('WorkRest Timer', { body })
      } catch {}
    },

    _startTick() {
      if (this.tickHandle) return
      const loop = () => {
        this.nowTs = Date.now()

        if (this.remainingMs <= 0) {
          // фаза закончилась — ждём решение пользователя
          this.awaitingAction = true
          this._notify(
            this.phase === 'work'
              ? 'Работа завершена — продолжить или отложить?'
              : 'Отдых завершён — продолжить или отложить?'
          )
          this._stopTick()
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

    goNextPhase() {
      if (this.phase === 'work') {
        this.workedMs += this.cfg.workMin * 60 * 1000
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
  },
})