import { defineHandler } from 'void';
import { lessons } from '../lessons';

export const loader = defineHandler((c) => c.redirect(`/lessons/${lessons[0].id}`));
