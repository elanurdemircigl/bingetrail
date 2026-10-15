
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_deletion_log": {
                  Row: {
                    "deleted_at": string,"id": number,"reason_code": string | null,"user_id_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "deleted_at"?: string,"id"?: never,"reason_code"?: string | null,"user_id_hash": string
                  }
                  Update: {
                    "deleted_at"?: string,"id"?: never,"reason_code"?: string | null,"user_id_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"episode_progress": {
                  Row: {
                    "episode_id": number,"title_id": number,"user_id": string,"watched_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "episode_id": number,"title_id": number,"user_id"?: string,"watched_at"?: string
                  }
                  Update: {
                    "episode_id"?: number,"title_id"?: number,"user_id"?: string,"watched_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "episode_progress_episode_fk"
      columns: ["episode_id","title_id"]
isOneToOne: false
      referencedRelation: "episodes"
      referencedColumns: ["id","title_id"]
    }
                  ]
                },"episodes": {
                  Row: {
                    "air_date": string | null,"episode_number": number,"fetched_at": string,"id": number,"name": NonNullable<Json>,"runtime": number | null,"season_id": number,"season_number": number,"title_id": number,"tmdb_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "air_date"?: string | null,"episode_number": number,"fetched_at"?: string,"id"?: never,"name"?: NonNullable<Json>,"runtime"?: number | null,"season_id": number,"season_number": number,"title_id": number,"tmdb_id"?: number | null
                  }
                  Update: {
                    "air_date"?: string | null,"episode_number"?: number,"fetched_at"?: string,"id"?: never,"name"?: NonNullable<Json>,"runtime"?: number | null,"season_id"?: number,"season_number"?: number,"title_id"?: number,"tmdb_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "episodes_season_fk"
      columns: ["season_id","title_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id","title_id"]
    },{
      foreignKeyName: "episodes_title_id_fkey"
      columns: ["title_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_reports": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"report": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"report": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"report"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"display_name": string | null,"id": string,"locale": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "bucket": string,"count": number,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"count"?: number,"user_id": string,"window_start": string
                  }
                  Update: {
                    "bucket"?: string,"count"?: number,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seasons": {
                  Row: {
                    "air_date": string | null,"episode_count": number | null,"fetched_at": string,"id": number,"name": NonNullable<Json>,"season_number": number,"title_id": number,"tmdb_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "air_date"?: string | null,"episode_count"?: number | null,"fetched_at"?: string,"id"?: never,"name"?: NonNullable<Json>,"season_number": number,"title_id": number,"tmdb_id"?: number | null
                  }
                  Update: {
                    "air_date"?: string | null,"episode_count"?: number | null,"fetched_at"?: string,"id"?: never,"name"?: NonNullable<Json>,"season_number"?: number,"title_id"?: number,"tmdb_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasons_title_id_fkey"
      columns: ["title_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["id"]
    }
                  ]
                },"titles": {
                  Row: {
                    "backdrop_path": string | null,"created_at": string,"fetched_at": string,"id": number,"last_referenced_at": string,"media_type": Database["public"]['Enums']["media_type"],"number_of_seasons": number | null,"original_title": string,"poster_path": string | null,"release_date": string | null,"tmdb_id": number,"tmdb_status": string | null,"translations": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "backdrop_path"?: string | null,"created_at"?: string,"fetched_at"?: string,"id"?: never,"last_referenced_at"?: string,"media_type": Database["public"]['Enums']["media_type"],"number_of_seasons"?: number | null,"original_title": string,"poster_path"?: string | null,"release_date"?: string | null,"tmdb_id": number,"tmdb_status"?: string | null,"translations"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "backdrop_path"?: string | null,"created_at"?: string,"fetched_at"?: string,"id"?: never,"last_referenced_at"?: string,"media_type"?: Database["public"]['Enums']["media_type"],"number_of_seasons"?: number | null,"original_title"?: string,"poster_path"?: string | null,"release_date"?: string | null,"tmdb_id"?: number,"tmdb_status"?: string | null,"translations"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"watchlist_items": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"last_activity_at": string,"notes": string | null,"rating": number | null,"started_at": string | null,"status": Database["public"]['Enums']["watch_status"],"title_id": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"last_activity_at"?: string,"notes"?: string | null,"rating"?: number | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["watch_status"],"title_id": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"last_activity_at"?: string,"notes"?: string | null,"rating"?: number | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["watch_status"],"title_id"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "watchlist_items_title_id_fkey"
      columns: ["title_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "catalog_cache_cleanup":
{ Args: { "p_dry_run"?: boolean,"p_older_than"?: string }; Returns: number
                           },
"catalog_cache_report":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"catalog_cache_stats":
{ Args: { "p_orphan_age"?: string }; Returns: Json
                           },
"catalog_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_continue_watching":
{ Args: { "p_limit"?: number }; Returns: {
              "aired_count": number,"item_id": string,"last_activity_at": string,"media_type": Database["public"]['Enums']["media_type"],"next_air_date": string,"next_episode_id": number,"next_episode_name": Json,"next_episode_number": number,"next_season_number": number,"original_title": string,"poster_path": string,"title_id": number,"tmdb_id": number,"translations": Json,"watched_count": number
            }[]
                           },
"get_title_progress":
{ Args: { "p_title_id": number }; Returns: {
              "aired_count": number,"catalog_complete": boolean,"watched_count": number
            }[]
                           },
"mark_episodes_watched":
{ Args: { "p_episode_ids": (number)[] }; Returns: number
                           },
"my_realtime_topic":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"purge_rate_limits":
{ Args: { "p_older_than"?: string }; Returns: number
                           },
"rate_limit_hit":
{ Args: { "p_bucket": string,"p_max_requests": number,"p_user_id": string,"p_window_seconds": number }; Returns: boolean
                           },
"server_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"unmark_episodes":
{ Args: { "p_episode_ids": (number)[] }; Returns: number
                           }
          }
          Enums: {
            "media_type": "movie"|"tv","watch_status": "planned"|"watching"|"completed"|"paused"|"dropped"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "media_type": ["movie", "tv"],"watch_status": ["planned", "watching", "completed", "paused", "dropped"]
          }
        }
} as const
