<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'

const s = useTimerStore()
const workedMM = computed(() =>
  String(Math.floor(s.overallWorkedMs / 1000 / 60)).padStart(2, '0')
)
const workedHH = computed(() =>
  String(Math.floor(s.overallWorkedMs / 1000 / 60 / 60)).padStart(2, '0')
)
const autoNextSeconds = computed(() => s.autoNextSeconds)

const showCenter = computed(() => s.phase !== 'idle')

const label = computed(() =>
  s.phase === 'work' ? 'Работа'
  : s.phase === 'rest' ? 'Отдых'
  : s.phase === 'done' ? 'Готово'
  : 'Ожидание'
)

const mm = computed(() => String(Math.floor(s.remainingMs / 1000 / 60)).padStart(2,'0'))
const ss = computed(() => String(Math.floor((s.remainingMs / 1000) % 60)).padStart(2,'0'))
const cs = computed(() => String(Math.floor((s.remainingMs % 1000) / 10)).padStart(2, '0'))
const overallPct = computed(() => (s.overallProgress * 100).toFixed(2) + '%')
</script>

<template>
  <div class="space-y-3">
    <div class="bg-slate-900 rounded-2xl p-5 flex items-center justify-between">
      <div> 
        <p class="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
          Фаза
          <span class="relative inline-flex">
            <span
              v-if="s.isRunning && !s.isPaused"
              class="absolute inline-flex h-full w-full animate-ping rounded-full"
              :class="s.phase === 'work' ? 'bg-emerald-400' : 'bg-sky-400'"
            ></span>
            <span
              class="relative inline-flex size-3 rounded-full"
              :class="
                s.phase === 'work' ? 'bg-emerald-500' :
                s.phase === 'rest' ? 'bg-sky-500' :
                'bg-slate-500'
              "
            ></span>
          </span>
        </p>
         <p class="text-xl font-semibold text-left">{{ label }}</p>
      </div>
      <!-- ЦЕНТР: динамический слот -->
  <div class="flex-1 text-center">
    <transition name="fade" mode="out-in">
      <!-- Автопереход -->
      <p
        v-if="s.awaitingAction && autoNextSeconds > 0"
        class="text-sm font-semibold text-amber-400"
      >
        Автопереход через {{ autoNextSeconds }} сек
      </p>

      <!-- Общее время работы -->
      <div
        v-else-if="showCenter"
        key="worked"
        class="font-mono text-2xl text-emerald-400 tabular-nums"
      >
        {{ workedHH }}:{{ workedMM }}
      </div>

       <div v-else key="empty"></div>
    </transition>
  </div>
      <div class="text-right">
        <p class="text-xs uppercase tracking-wide text-slate-400">Осталось</p>
        <p class="text-2xl font-bold tabular-nums">
          {{ mm }}:{{ ss }}<span class="text-sm opacity-70">.{{ cs }}</span>
        </p>
      </div>
    </div>

        <!-- ГЛОБАЛЬНЫЙ прогресс по рабочему времени -->
    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
          class="h-full bg-emerald-500 transition-[width] duration-500 ease-out"
          :style="{ width: (s.overallProgress * 100).toFixed(2) + '%' }"
        />
      </div>
    </div>
</template>