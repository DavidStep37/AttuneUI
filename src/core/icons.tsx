import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronUp, Copy, Globe2, Maximize2, Minus, Play, Plus, Rainbow, RotateCcw, RotateCw, Waves, X, type LucideIcon, type LucideProps } from "lucide-react";
import { motion } from "motion/react";

// One visual baseline for interface icons. Only the named icons are bundled.
const icon = (Component: LucideIcon) => (props: LucideProps) => <Component size={14} strokeWidth={1.75} aria-hidden="true" focusable="false" {...props} />;
export const IconPlay = icon(Play);
export const IconReplay = icon(RotateCw);
export const IconReset = icon(RotateCcw);
export const IconCopy = icon(Copy);
export const IconCheck = icon(Check);
export const IconExpand = icon(Maximize2);
export const IconPlus = icon(Plus);
export const IconMinus = icon(Minus);
export const IconClose = icon(X);
export const IconExternal = icon(ArrowUpRight);
export const IconDownRight = icon(ArrowDownRight);
export const IconDownLeft = icon(ArrowDownLeft);
export const IconShape = icon(Rainbow);
export const IconRespond = icon(Waves);
export const IconConnect = icon(Globe2);
export const MotionChevronDown = motion.create(ChevronDown);
export const MotionChevronUp = motion.create(ChevronUp);
