<template>
  <TextInput v-model="value" :type="type" name="value[]" required />
</template>

<script lang="ts" setup>
import { computed, toRefs } from 'vue'
import type inputTypes from '@/config/smart-playlist/inputTypes'
import TextInput from '@/components/ui/form/TextInput.vue'

const props = withDefaults(defineProps<{ type: keyof typeof inputTypes, value?: any }>(), { value: undefined })
const emit = defineEmits<{ (e: 'update:modelValue', value: any): void }>()

const { type } = toRefs(props)

const value = computed({
  get: () => props.value,
  set: value => emit('update:modelValue', value),
})
</script>
