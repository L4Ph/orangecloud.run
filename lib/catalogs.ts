import type { Messages } from '@lingui/core';
import type { Locale } from './locales';
import { messages as ja } from '../locales/ja/messages.po';
import { messages as en } from '../locales/en/messages.po';
import { messages as zh } from '../locales/zh/messages.po';
import { messages as ko } from '../locales/ko/messages.po';

export const catalogs: Record<Locale, Messages> = { ja, en, zh, ko };
