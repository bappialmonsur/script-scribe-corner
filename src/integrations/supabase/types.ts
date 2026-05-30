export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at: string
          date: string
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at?: string
          date: string
          id?: string
          reason?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"]
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"] | null
          created_at: string
          description: string | null
          duration: string | null
          fee: string | null
          id: string
          image_path: string | null
          is_active: boolean
          sort_order: number
          tag: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          description?: string | null
          duration?: string | null
          fee?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          sort_order?: number
          tag?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          description?: string | null
          duration?: string | null
          fee?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          sort_order?: number
          tag?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_results: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          marks: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          marks?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          marks?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at: string
          exam_date: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          full_marks: number
          id: string
          pattern: Database["public"]["Enums"]["exam_pattern"]
          subject: string
          title: string | null
          updated_at: string
        }
        Insert: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at?: string
          exam_date: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          full_marks: number
          id?: string
          pattern?: Database["public"]["Enums"]["exam_pattern"]
          subject: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"]
          created_at?: string
          exam_date?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          full_marks?: number
          id?: string
          pattern?: Database["public"]["Enums"]["exam_pattern"]
          subject?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          author_id: string | null
          author_meta: string | null
          author_name: string | null
          author_role: string
          body: string | null
          class_level: Database["public"]["Enums"]["class_level"] | null
          created_at: string
          id: string
          is_active: boolean
          media_path: string | null
          media_type: Database["public"]["Enums"]["feed_media_type"]
          status: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_meta?: string | null
          author_name?: string | null
          author_role?: string
          body?: string | null
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_path?: string | null
          media_type?: Database["public"]["Enums"]["feed_media_type"]
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_meta?: string | null
          author_name?: string | null
          author_role?: string
          body?: string | null
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_path?: string | null
          media_type?: Database["public"]["Enums"]["feed_media_type"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_path: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_path: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_path?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          badge: string | null
          created_at: string
          id: string
          image_path: string
          is_active: boolean
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          id?: string
          image_path: string
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          id?: string
          image_path?: string
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mcq_questions: {
        Row: {
          chapter: string
          class_level: Database["public"]["Enums"]["class_level"]
          correct_index: number
          created_at: string
          created_by: string | null
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          question: string
          source: string
          subject: string
          updated_at: string
        }
        Insert: {
          chapter: string
          class_level: Database["public"]["Enums"]["class_level"]
          correct_index: number
          created_at?: string
          created_by?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          options: Json
          question: string
          source?: string
          subject: string
          updated_at?: string
        }
        Update: {
          chapter?: string
          class_level?: Database["public"]["Enums"]["class_level"]
          correct_index?: number
          created_at?: string
          created_by?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question?: string
          source?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          sender_meta: string | null
          sender_name: string | null
          sender_role: string
          student_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_meta?: string | null
          sender_name?: string | null
          sender_role: string
          student_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_meta?: string | null
          sender_name?: string | null
          sender_role?: string
          student_user_id?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          body: string | null
          class_level: Database["public"]["Enums"]["class_level"] | null
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_meta: string | null
          actor_name: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          post_id: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_meta?: string | null
          actor_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_meta?: string | null
          actor_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_notes: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at: string
          file_path: string
          file_size_kb: number | null
          id: string
          is_active: boolean
          pages: number | null
          sort_order: number
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at?: string
          file_path: string
          file_size_kb?: number | null
          id?: string
          is_active?: boolean
          pages?: number | null
          sort_order?: number
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"]
          created_at?: string
          file_path?: string
          file_size_kb?: number | null
          id?: string
          is_active?: boolean
          pages?: number | null
          sort_order?: number
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_meta: string | null
          author_name: string | null
          author_role: string
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_meta?: string | null
          author_name?: string | null
          author_role?: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          author_meta?: string | null
          author_name?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          admission_date: string
          batch: Database["public"]["Enums"]["batch_time"]
          class_level: Database["public"]["Enums"]["class_level"]
          created_at: string
          department: Database["public"]["Enums"]["department_type"]
          father_name: string | null
          father_occupation: string | null
          full_name: string
          guardian_phone: string | null
          id: string
          is_active: boolean
          mother_name: string | null
          phone: string | null
          photo_path: string | null
          roll: string | null
          school_name: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string
          batch: Database["public"]["Enums"]["batch_time"]
          class_level: Database["public"]["Enums"]["class_level"]
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"]
          father_name?: string | null
          father_occupation?: string | null
          full_name: string
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          mother_name?: string | null
          phone?: string | null
          photo_path?: string | null
          roll?: string | null
          school_name?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string
          batch?: Database["public"]["Enums"]["batch_time"]
          class_level?: Database["public"]["Enums"]["class_level"]
          created_at?: string
          department?: Database["public"]["Enums"]["department_type"]
          father_name?: string | null
          father_occupation?: string | null
          full_name?: string
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          mother_name?: string | null
          phone?: string | null
          photo_path?: string | null
          roll?: string | null
          school_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      teacher_permissions: {
        Row: {
          created_at: string
          feature: Database["public"]["Enums"]["teacher_feature"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: Database["public"]["Enums"]["teacher_feature"]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: Database["public"]["Enums"]["teacher_feature"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      assign_admin_role: { Args: { _user_id: string }; Returns: boolean }
      bootstrap_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_teacher_permission: {
        Args: {
          _feature: Database["public"]["Enums"]["teacher_feature"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_resolve_meta: { Args: { _user_id: string }; Returns: string }
      notify_resolve_name: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "student" | "teacher"
      attendance_status: "present" | "absent"
      batch_time: "morning" | "afternoon" | "evening"
      class_level: "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12"
      department_type: "science" | "business" | "none"
      exam_pattern: "written" | "mcq"
      exam_type: "daily" | "weekly" | "model_test"
      feed_media_type: "text" | "image" | "video" | "audio"
      teacher_feature: "attendance" | "results" | "newsfeed" | "admission"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student", "teacher"],
      attendance_status: ["present", "absent"],
      batch_time: ["morning", "afternoon", "evening"],
      class_level: ["5", "6", "7", "8", "9", "10", "11", "12"],
      department_type: ["science", "business", "none"],
      exam_pattern: ["written", "mcq"],
      exam_type: ["daily", "weekly", "model_test"],
      feed_media_type: ["text", "image", "video", "audio"],
      teacher_feature: ["attendance", "results", "newsfeed", "admission"],
    },
  },
} as const
