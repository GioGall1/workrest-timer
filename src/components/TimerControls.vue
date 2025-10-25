<script setup lang="ts">
import { onMounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
const s = useTimerStore()
onMounted(() => s.ensurePermission())
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <button class="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold" @click="s.start()">Старт</button>
    <button class="rounded-2xl bg-amber-600 px-4 py-3 font-semibold" @click="s.pause()">Пауза</button>
    <button class="rounded-2xl bg-indigo-600 px-4 py-3 font-semibold" @click="s.snooze()">Отложить</button>
    <button class="rounded-2xl bg-slate-700 px-4 py-3 font-semibold" @click="s.skip()">Пропустить фазу</button>
    <button class="col-span-2 rounded-2xl bg-rose-600 px-4 py-3 font-semibold" @click="s.reset()">Сброс</button>
  </div>
</template>