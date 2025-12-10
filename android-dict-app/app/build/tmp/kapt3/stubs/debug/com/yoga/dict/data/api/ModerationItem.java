package com.yoga.dict.data.api;

import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.Source;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import retrofit2.Response;
import retrofit2.http.*;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0004\n\u0002\u0010$\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0002\b<\b\u0086\b\u0018\u00002\u00020\u0001B\u00bd\u0001\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\b\u0010\u0004\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0006\u001a\u0004\u0018\u00010\u0005\u0012\u0006\u0010\u0007\u001a\u00020\u0005\u0012\b\u0010\b\u001a\u0004\u0018\u00010\u0003\u0012\u0014\u0010\t\u001a\u0010\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u0001\u0018\u00010\n\u0012\u0006\u0010\u000b\u001a\u00020\u0005\u0012\u0006\u0010\f\u001a\u00020\r\u0012\b\u0010\u000e\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u000f\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0010\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0011\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0012\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0013\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0014\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0015\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0016\u001a\u0004\u0018\u00010\u0005\u0012\b\u0010\u0017\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\u0002\u0010\u0018J\t\u00101\u001a\u00020\u0003H\u00c6\u0003J\u000b\u00102\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00103\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00104\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00105\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00106\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00107\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00108\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u00109\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u0010:\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u0010;\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u000b\u0010<\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\t\u0010=\u001a\u00020\u0005H\u00c6\u0003J\u0010\u0010>\u001a\u0004\u0018\u00010\u0003H\u00c6\u0003\u00a2\u0006\u0002\u0010*J\u0017\u0010?\u001a\u0010\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u0001\u0018\u00010\nH\u00c6\u0003J\t\u0010@\u001a\u00020\u0005H\u00c6\u0003J\t\u0010A\u001a\u00020\rH\u00c6\u0003J\u000b\u0010B\u001a\u0004\u0018\u00010\u0005H\u00c6\u0003J\u00ea\u0001\u0010C\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\n\b\u0002\u0010\u0004\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0006\u001a\u0004\u0018\u00010\u00052\b\b\u0002\u0010\u0007\u001a\u00020\u00052\n\b\u0002\u0010\b\u001a\u0004\u0018\u00010\u00032\u0016\b\u0002\u0010\t\u001a\u0010\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u0001\u0018\u00010\n2\b\b\u0002\u0010\u000b\u001a\u00020\u00052\b\b\u0002\u0010\f\u001a\u00020\r2\n\b\u0002\u0010\u000e\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u000f\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0010\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0011\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0012\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0013\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0014\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0015\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0016\u001a\u0004\u0018\u00010\u00052\n\b\u0002\u0010\u0017\u001a\u0004\u0018\u00010\u0005H\u00c6\u0001\u00a2\u0006\u0002\u0010DJ\u0013\u0010E\u001a\u00020\r2\b\u0010F\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010G\u001a\u00020\u0003H\u00d6\u0001J\t\u0010H\u001a\u00020\u0005H\u00d6\u0001R\u0013\u0010\u0004\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0019\u0010\u001aR\u0011\u0010\u000b\u001a\u00020\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001b\u0010\u001aR\u0011\u0010\u0007\u001a\u00020\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001c\u0010\u001aR\u0013\u0010\u0016\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001d\u0010\u001aR\u0013\u0010\u0017\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001e\u0010\u001aR\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001f\u0010 R\u001f\u0010\t\u001a\u0010\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u0001\u0018\u00010\n\u00a2\u0006\b\n\u0000\u001a\u0004\b!\u0010\"R\u0013\u0010\u0010\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b#\u0010\u001aR\u0013\u0010\u0011\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b$\u0010\u001aR\u0011\u0010\f\u001a\u00020\r\u00a2\u0006\b\n\u0000\u001a\u0004\b%\u0010&R\u0013\u0010\u000f\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\'\u0010\u001aR\u0013\u0010\u000e\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b(\u0010\u001aR\u0015\u0010\b\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\n\n\u0002\u0010+\u001a\u0004\b)\u0010*R\u0013\u0010\u0006\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b,\u0010\u001aR\u0013\u0010\u0015\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b-\u0010\u001aR\u0013\u0010\u0012\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b.\u0010\u001aR\u0013\u0010\u0013\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b/\u0010\u001aR\u0013\u0010\u0014\u001a\u0004\u0018\u00010\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b0\u0010\u001a\u00a8\u0006I"}, d2 = {"Lcom/yoga/dict/data/api/ModerationItem;", "", "id", "", "asana_name", "", "source_id", "error_message", "row_number", "import_data", "", "created_at", "resolved", "", "resolved_by", "resolved_at", "moderation_type", "object_type", "suggested_name_ru", "suggested_name_sanskrit", "suggested_transliteration", "suggested_definition", "existing_name_id", "existing_name_ru", "(ILjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Integer;Ljava/util/Map;Ljava/lang/String;ZLjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", "getAsana_name", "()Ljava/lang/String;", "getCreated_at", "getError_message", "getExisting_name_id", "getExisting_name_ru", "getId", "()I", "getImport_data", "()Ljava/util/Map;", "getModeration_type", "getObject_type", "getResolved", "()Z", "getResolved_at", "getResolved_by", "getRow_number", "()Ljava/lang/Integer;", "Ljava/lang/Integer;", "getSource_id", "getSuggested_definition", "getSuggested_name_ru", "getSuggested_name_sanskrit", "getSuggested_transliteration", "component1", "component10", "component11", "component12", "component13", "component14", "component15", "component16", "component17", "component18", "component2", "component3", "component4", "component5", "component6", "component7", "component8", "component9", "copy", "(ILjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Integer;Ljava/util/Map;Ljava/lang/String;ZLjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Lcom/yoga/dict/data/api/ModerationItem;", "equals", "other", "hashCode", "toString", "app_debug"})
public final class ModerationItem {
    private final int id = 0;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String asana_name = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String source_id = null;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String error_message = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.Integer row_number = null;
    @org.jetbrains.annotations.Nullable()
    private final java.util.Map<java.lang.String, java.lang.Object> import_data = null;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String created_at = null;
    private final boolean resolved = false;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String resolved_by = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String resolved_at = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String moderation_type = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String object_type = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String suggested_name_ru = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String suggested_name_sanskrit = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String suggested_transliteration = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String suggested_definition = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String existing_name_id = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String existing_name_ru = null;
    
    public ModerationItem(int id, @org.jetbrains.annotations.Nullable()
    java.lang.String asana_name, @org.jetbrains.annotations.Nullable()
    java.lang.String source_id, @org.jetbrains.annotations.NotNull()
    java.lang.String error_message, @org.jetbrains.annotations.Nullable()
    java.lang.Integer row_number, @org.jetbrains.annotations.Nullable()
    java.util.Map<java.lang.String, ? extends java.lang.Object> import_data, @org.jetbrains.annotations.NotNull()
    java.lang.String created_at, boolean resolved, @org.jetbrains.annotations.Nullable()
    java.lang.String resolved_by, @org.jetbrains.annotations.Nullable()
    java.lang.String resolved_at, @org.jetbrains.annotations.Nullable()
    java.lang.String moderation_type, @org.jetbrains.annotations.Nullable()
    java.lang.String object_type, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_name_ru, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_name_sanskrit, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_transliteration, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_definition, @org.jetbrains.annotations.Nullable()
    java.lang.String existing_name_id, @org.jetbrains.annotations.Nullable()
    java.lang.String existing_name_ru) {
        super();
    }
    
    public final int getId() {
        return 0;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getAsana_name() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getSource_id() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getError_message() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Integer getRow_number() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.util.Map<java.lang.String, java.lang.Object> getImport_data() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getCreated_at() {
        return null;
    }
    
    public final boolean getResolved() {
        return false;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getResolved_by() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getResolved_at() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getModeration_type() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getObject_type() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getSuggested_name_ru() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getSuggested_name_sanskrit() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getSuggested_transliteration() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getSuggested_definition() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getExisting_name_id() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getExisting_name_ru() {
        return null;
    }
    
    public final int component1() {
        return 0;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component10() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component11() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component12() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component13() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component14() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component15() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component16() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component17() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component18() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component2() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component3() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String component4() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Integer component5() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.util.Map<java.lang.String, java.lang.Object> component6() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String component7() {
        return null;
    }
    
    public final boolean component8() {
        return false;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component9() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.yoga.dict.data.api.ModerationItem copy(int id, @org.jetbrains.annotations.Nullable()
    java.lang.String asana_name, @org.jetbrains.annotations.Nullable()
    java.lang.String source_id, @org.jetbrains.annotations.NotNull()
    java.lang.String error_message, @org.jetbrains.annotations.Nullable()
    java.lang.Integer row_number, @org.jetbrains.annotations.Nullable()
    java.util.Map<java.lang.String, ? extends java.lang.Object> import_data, @org.jetbrains.annotations.NotNull()
    java.lang.String created_at, boolean resolved, @org.jetbrains.annotations.Nullable()
    java.lang.String resolved_by, @org.jetbrains.annotations.Nullable()
    java.lang.String resolved_at, @org.jetbrains.annotations.Nullable()
    java.lang.String moderation_type, @org.jetbrains.annotations.Nullable()
    java.lang.String object_type, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_name_ru, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_name_sanskrit, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_transliteration, @org.jetbrains.annotations.Nullable()
    java.lang.String suggested_definition, @org.jetbrains.annotations.Nullable()
    java.lang.String existing_name_id, @org.jetbrains.annotations.Nullable()
    java.lang.String existing_name_ru) {
        return null;
    }
    
    @java.lang.Override()
    public boolean equals(@org.jetbrains.annotations.Nullable()
    java.lang.Object other) {
        return false;
    }
    
    @java.lang.Override()
    public int hashCode() {
        return 0;
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.NotNull()
    public java.lang.String toString() {
        return null;
    }
}