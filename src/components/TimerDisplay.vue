<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'

const s = useTimerStore()

const label = computed(() =>
  s.phase === 'work' ? 'Работа'
  : s.phase === 'rest' ? 'Отдых'
  : s.phase === 'done' ? 'Готово'
  : 'Ожидание'
)

const mm = computed(() => String(Math.floor(s.remainingMs / 1000 / 60)).padStart(2,'0'))
const ss = computed(() => String(Math.floor((s.remainingMs / 1000) % 60)).padStart(2,'0'))
</script>

<template>
  <div class="bg-slate-900 rounded-2xl p-5 flex items-center justify-between">
    <div>
      <p class="text-xs uppercase tracking-wide text-slate-400">Фаза</p>
      <p class="text-xl font-semibold">{{ label }}</p>
    </div>
    <div class="text-right">
      <p class="text-xs uppercase tracking-wide text-slate-400">Осталось</p>
      <p class="text-2xl font-bold tabular-nums">{{ mm }}:{{ ss }}</p>
    </div>
  </div>
</template>