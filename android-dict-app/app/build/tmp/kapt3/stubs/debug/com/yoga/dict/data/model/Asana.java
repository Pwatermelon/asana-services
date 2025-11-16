package com.yoga.dict.data.model;

import android.os.Parcelable;
import kotlinx.parcelize.Parcelize;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000J\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u000e\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0087\b\u0018\u00002\u00020\u0001B1\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\f\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\b0\u0007\u0012\f\u0010\t\u001a\b\u0012\u0004\u0012\u00020\n0\u0007\u00a2\u0006\u0002\u0010\u000bJ\t\u0010\u0013\u001a\u00020\u0003H\u00c6\u0003J\t\u0010\u0014\u001a\u00020\u0005H\u00c6\u0003J\u000f\u0010\u0015\u001a\b\u0012\u0004\u0012\u00020\b0\u0007H\u00c6\u0003J\u000f\u0010\u0016\u001a\b\u0012\u0004\u0012\u00020\n0\u0007H\u00c6\u0003J=\u0010\u0017\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\u000e\b\u0002\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\b0\u00072\u000e\b\u0002\u0010\t\u001a\b\u0012\u0004\u0012\u00020\n0\u0007H\u00c6\u0001J\t\u0010\u0018\u001a\u00020\u0019H\u00d6\u0001J\u0013\u0010\u001a\u001a\u00020\u001b2\b\u0010\u001c\u001a\u0004\u0018\u00010\u001dH\u00d6\u0003J\t\u0010\u001e\u001a\u00020\u0019H\u00d6\u0001J\t\u0010\u001f\u001a\u00020\u0003H\u00d6\u0001J\u0019\u0010 \u001a\u00020!2\u0006\u0010\"\u001a\u00020#2\u0006\u0010$\u001a\u00020\u0019H\u00d6\u0001R\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u0011\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000fR\u0017\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\b0\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u0011R\u0017\u0010\t\u001a\b\u0012\u0004\u0012\u00020\n0\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0012\u0010\u0011\u00a8\u0006%"}, d2 = {"Lcom/yoga/dict/data/model/Asana;", "Landroid/os/Parcelable;", "id", "", "name", "Lcom/yoga/dict/data/model/AsanaName;", "photos", "", "Lcom/yoga/dict/data/model/AsanaPhoto;", "sources", "Lcom/yoga/dict/data/model/AsanaSource;", "(Ljava/lang/String;Lcom/yoga/dict/data/model/AsanaName;Ljava/util/List;Ljava/util/List;)V", "getId", "()Ljava/lang/String;", "getName", "()Lcom/yoga/dict/data/model/AsanaName;", "getPhotos", "()Ljava/util/List;", "getSources", "component1", "component2", "component3", "component4", "copy", "describeContents", "", "equals", "", "other", "", "hashCode", "toString", "writeToParcel", "", "parcel", "Landroid/os/Parcel;", "flags", "app_debug"})
@kotlinx.parcelize.Parcelize()
public final class Asana implements android.os.Parcelable {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String id = null;
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.model.AsanaName name = null;
    @org.jetbrains.annotations.NotNull()
    private final java.util.List<com.yoga.dict.data.model.AsanaPhoto> photos = null;
    @org.jetbrains.annotations.NotNull()
    private final java.util.List<com.yoga.dict.data.model.AsanaSource> sources = null;
    
    public Asana(@org.jetbrains.annotations.NotNull()
    java.lang.String id, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.AsanaName name, @org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.AsanaPhoto> photos, @org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.AsanaSource> sources) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getId() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.yoga.dict.data.model.AsanaName getName() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<com.yoga.dict.data.model.AsanaPhoto> getPhotos() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<com.yoga.dict.data.model.AsanaSource> getSources() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String component1() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.yoga.dict.data.model.AsanaName component2() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<com.yoga.dict.data.model.AsanaPhoto> component3() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<com.yoga.dict.data.model.AsanaSource> component4() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.yoga.dict.data.model.Asana copy(@org.jetbrains.annotations.NotNull()
    java.lang.String id, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.AsanaName name, @org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.AsanaPhoto> photos, @org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.AsanaSource> sources) {
        return null;
    }
    
    @java.lang.Override()
    public int describeContents() {
        return 0;
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
    
    @java.lang.Override()
    public void writeToParcel(@org.jetbrains.annotations.NotNull()
    android.os.Parcel parcel, int flags) {
    }
}