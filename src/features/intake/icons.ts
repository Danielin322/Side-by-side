import {
  BellRing,
  CalendarCheck,
  FolderOpen,
  HandHeart,
  Keyboard,
  Lightbulb,
  MapPin,
  Phone,
  PhoneCall,
  ThumbsUp,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { MeetingMode, SupportType } from "./schema";

export const SUPPORT_ICONS: Record<SupportType, LucideIcon> = {
  documents: FolderOpen,
  rights: Lightbulb,
  co_typing: Keyboard,
  scheduling: CalendarCheck,
  calls: PhoneCall,
  accompaniment: HandHeart,
  follow_up: BellRing,
};

export const MEETING_ICONS: Record<MeetingMode, LucideIcon> = {
  in_person: MapPin,
  video: Video,
  phone: Phone,
  any: ThumbsUp,
};
