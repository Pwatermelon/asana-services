package com.yoga.dict.data.api;

import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.Source;
import retrofit2.Response;
import retrofit2.http.*;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0007\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0002\bf\u0018\u00002\u00020\u0001J\u001e\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0005\u001a\u00020\u0006H\u00a7@\u00a2\u0006\u0002\u0010\u0007J\u001a\u0010\b\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\n0\t0\u0003H\u00a7@\u00a2\u0006\u0002\u0010\u000bJ\u001a\u0010\f\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00040\t0\u0003H\u00a7@\u00a2\u0006\u0002\u0010\u000bJ$\u0010\r\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00040\t0\u00032\b\b\u0001\u0010\u000e\u001a\u00020\u0006H\u00a7@\u00a2\u0006\u0002\u0010\u0007J$\u0010\u000f\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00040\t0\u00032\b\b\u0001\u0010\u0010\u001a\u00020\u0006H\u00a7@\u00a2\u0006\u0002\u0010\u0007J(\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\u00120\u00032\b\b\u0001\u0010\u0005\u001a\u00020\u00062\b\b\u0001\u0010\u0010\u001a\u00020\u0006H\u00a7@\u00a2\u0006\u0002\u0010\u0013J\u001a\u0010\u0014\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00150\t0\u0003H\u00a7@\u00a2\u0006\u0002\u0010\u000bJ.\u0010\u0016\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00040\t0\u00032\b\b\u0001\u0010\u0017\u001a\u00020\u00062\b\b\u0003\u0010\u0018\u001a\u00020\u0019H\u00a7@\u00a2\u0006\u0002\u0010\u001a\u00f8\u0001\u0000\u0082\u0002\u0006\n\u0004\b!0\u0001\u00a8\u0006\u001b\u00c0\u0006\u0001"}, d2 = {"Lcom/yoga/dict/data/api/DictApiService;", "", "getAsanaById", "Lretrofit2/Response;", "Lcom/yoga/dict/data/model/Asana;", "asanaId", "", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getAsanaNames", "", "Lcom/yoga/dict/data/model/AsanaName;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getAsanas", "getAsanasByLetter", "letter", "getAsanasBySource", "sourceId", "getPhotoOfAsanaFromSource", "Lcom/yoga/dict/data/model/AsanaPhoto;", "(Ljava/lang/String;Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getSources", "Lcom/yoga/dict/data/model/Source;", "searchAsanas", "query", "fuzzy", "", "(Ljava/lang/String;ZLkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public abstract interface DictApiService {
    
    @retrofit2.http.GET(value = "api/asanas")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanas(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Asana>>> $completion);
    
    @retrofit2.http.GET(value = "api/asana/{asana_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanaById(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.model.Asana>> $completion);
    
    @retrofit2.http.GET(value = "api/asanas/by-letter/{letter}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanasByLetter(@retrofit2.http.Path(value = "letter")
    @org.jetbrains.annotations.NotNull()
    java.lang.String letter, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Asana>>> $completion);
    
    @retrofit2.http.GET(value = "api/asanas/by-source/{source_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanasBySource(@retrofit2.http.Path(value = "source_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String sourceId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Asana>>> $completion);
    
    @retrofit2.http.GET(value = "api/asanas/search")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object searchAsanas(@retrofit2.http.Query(value = "query")
    @org.jetbrains.annotations.NotNull()
    java.lang.String query, @retrofit2.http.Query(value = "fuzzy")
    boolean fuzzy, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Asana>>> $completion);
    
    @retrofit2.http.GET(value = "api/sources")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getSources(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Source>>> $completion);
    
    @retrofit2.http.GET(value = "api/asana-names")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanaNames(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.AsanaName>>> $completion);
    
    @retrofit2.http.GET(value = "api/asana/{asana_id}/photo-by-source/{source_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getPhotoOfAsanaFromSource(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @retrofit2.http.Path(value = "source_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String sourceId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.model.AsanaPhoto>> $completion);
}