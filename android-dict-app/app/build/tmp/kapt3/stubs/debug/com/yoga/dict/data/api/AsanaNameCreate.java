package com.yoga.dict.data.api;

import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.Source;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import retrofit2.Response;
import retrofit2.http.*;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u000f\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\b\u0086\b\u0018\u00002\u00020\u0001B1\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\n\b\u0002\u0010\u0004\u001a\u0004\u0018\u00010\u0003\u0012\n\b\u0002\u0010\u0005\u001a\u0004\u0018\u00010\u0003\u0012\n\b\u0002\u0010\u0006\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\u0002\u0010\u0007J\t\u0010\r\u001a\u00020\u0003H\u00c6\u0003J\u000b\u0010\u000e\u001a\u0004\u0018\u00010\u0003H\u00c6\u0003J\u000b\u0010\u000f\u001a\u0004\u0018\u00010\u0003H\u00c6\u0003J\u000b\u0010\u0010\u001a\u0004\u0018\u00010\u0003H\u00c6\u0003J7\u0010\u0011\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\n\b\u0002\u0010\u0004\u001a\u0004\u0018\u00010\u00032\n\b\u0002\u0010\u0005\u001a\u0004\u0018\u00010\u00032\n\b\u0002\u0010\u0006\u001a\u0004\u0018\u00010\u0003H\u00c6\u0001J\u0013\u0010\u0012\u001a\u00020\u00132\b\u0010\u0014\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010\u0015\u001a\u00020\u0016H\u00d6\u0001J\t\u0010\u0017\u001a\u00020\u0003H\u00d6\u0001R\u0013\u0010\u0006\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\b\u0010\tR\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\n\u0010\tR\u0013\u0010\u0004\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\tR\u0013\u0010\u0005\u001a\u0004\u0018\u00010\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\f\u0010\t\u00a8\u0006\u0018"}, d2 = {"Lcom/yoga/dict/data/api/AsanaNameCreate;", "", "name_ru", "", "name_sanskrit", "transliteration", "definition", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", "getDefinition", "()Ljava/lang/String;", "getName_ru", "getName_sanskrit", "getTransliteration", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "", "toString", "app_debug"})
public final class AsanaNameCreate {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String name_ru = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String name_sanskrit = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String transliteration = null;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.String definition = null;
    
    public AsanaNameCreate(@org.jetbrains.annotations.NotNull()
    java.lang.String name_ru, @org.jetbrains.annotations.Nullable()
    java.lang.String name_sanskrit, @org.jetbrains.annotations.Nullable()
    java.lang.String transliteration, @org.jetbrains.annotations.Nullable()
    java.lang.String definition) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getName_ru() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getName_sanskrit() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getTransliteration() {
        return null;
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String getDefinition() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String component1() {
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
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.String component4() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.yoga.dict.data.api.AsanaNameCreate copy(@org.jetbrains.annotations.NotNull()
    java.lang.String name_ru, @org.jetbrains.annotations.Nullable()
    java.lang.String name_sanskrit, @org.jetbrains.annotations.Nullable()
    java.lang.String transliteration, @org.jetbrains.annotations.Nullable()
    java.lang.String definition) {
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