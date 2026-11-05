import {validateReleaseEnvironment} from './releaseEnvironment.mjs';
import {validateStagingEnvironment,STAGING_REF} from './stagingEnvironment.mjs';
import { validateEnvironment } from './environment';
import { createClient } from '@supabase/supabase-js'

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string
          full_name: string
          avatar_url: string
          phone: string
          location: string
          rating: number
          created_at: string
        },
        {
          id: string
          full_name?: string
          avatar_url?: string
          phone?: string
          location?: string
          rating?: number
          created_at?: string
        }
      >
      items: Table<
        {
          id: string
          owner_id: string | null
          title: string | null
          description: string | null
          category: string | null
          status: string | null
          location_name: string | null
          lat: number | null
          lng: number | null
          date: string | null
          image_url: string | null
          reward: string | null
          contact_count: number
          created_at: string
        },
        {
          id?: string
          owner_id: string
          title: string
          description: string
          category: string
          status: string
          location_name: string
          lat: number
          lng: number
          date: string
          image_url?: string
          reward?: string | null
          contact_count?: number
          created_at?: string
        }
      >
      messages: Table<
        {
          id: string
          item_id: string
          sender_id: string
          recipient_id: string
          sender_name: string
          sender_avatar: string
          item_title: string
          item_image: string
          text: string
          is_read: boolean
          created_at: string
        },
        {
          id?: string
          item_id: string
          sender_id: string
          recipient_id: string
          sender_name: string
          sender_avatar?: string
          item_title: string
          item_image?: string
          text: string
          is_read?: boolean
          created_at?: string
        }
      >
      notifications: Table<
        {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          related_item_id: string | null
          related_user_id: string | null
          is_read: boolean
          created_at: string
        },
        {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          related_item_id?: string | null
          related_user_id?: string | null
          is_read?: boolean
          created_at?: string
        }
      >
      push_subscriptions: Table<
        {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
          updated_at?: string
        }
      >
    }
    Views: {
      public_profiles: {
        Row: Database['public']['Tables']['profiles']['Row']
        Relationships: []
      }
    }
    Functions: {
      publish_item_once: {
        Args:{p_request_key:string;p_payload:Omit<import('./publicationDelivery').PublicationInput,'owner_id'>}
        Returns:Database['public']['Tables']['items']['Row'][]
      }
      buscag_capabilities: { Args: Record<string,never>; Returns: {queued_match_notifications:boolean}[] };
      send_message_once: {
        Args: {p_request_key:string;p_item_id:string;p_recipient_id:string;p_text:string}
        Returns: Database['public']['Tables']['messages']['Row'][]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const staging=import.meta.env.MODE==='staging';
export const configurationError = (staging?validateStagingEnvironment(import.meta.env):import.meta.env.MODE==='release'?validateReleaseEnvironment(import.meta.env):null) || validateEnvironment(import.meta.env, import.meta.env.PROD&&!staging);
export const isSupabaseConfigured = !configurationError

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey,staging?{auth:{storageKey:`buscag-staging-${STAGING_REF}-auth`}}:undefined)
  : null
