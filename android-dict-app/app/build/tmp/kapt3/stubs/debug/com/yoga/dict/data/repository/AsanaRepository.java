package com.yoga.dict.data.repository;

import com.yoga.dict.data.api.DictApiService;
import com.yoga.dict.data.api.SameAsRequest;
import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.Source;
import javax.inject.Inject;
import javax.inject.Singleton;

@javax.inject.Singleton()
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000B\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0010\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0002\b\u0006\n\u0002\u0010\u000b\n\u0002\b\u0005\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0010\u0010\u0005\u001a\u00020\u00062\u0006\u0010\u0007\u001a\u00020\u0006H\u0002J\"\u0010\b\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\tH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\f\u0010\rJ$\u0010\u000e\u001a\b\u0012\u0004\u0012\u00020\u000b0\t2\u0006\u0010\u000f\u001a\u00020\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0010\u0010\u0011J*\u0010\u0012\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\t2\u0006\u0010\u0013\u001a\u00020\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0014\u0010\u0011J*\u0010\u0015\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\t2\u0006\u0010\u0016\u001a\u00020\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0017\u0010\u0011J*\u0010\u0018\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\t2\u0006\u0010\u0019\u001a\u00020\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001a\u0010\u0011J\"\u0010\u001b\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u001c0\n0\tH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001d\u0010\rJ,\u0010\u001e\u001a\b\u0012\u0004\u0012\u00020\u001f0\t2\u0006\u0010\u0019\u001a\u00020\u00062\u0006\u0010 \u001a\u00020\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b!\u0010\"J4\u0010#\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\t2\u0006\u0010$\u001a\u00020\u00062\b\b\u0002\u0010%\u001a\u00020&H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\'\u0010(J,\u0010)\u001a\b\u0012\u0004\u0012\u00020\u001f0\t2\u0006\u0010\u0019\u001a\u00020\u00062\u0006\u0010 \u001a\u00020\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b*\u0010\"R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u0082\u0002\u000b\n\u0002\b!\n\u0005\b\u00a1\u001e0\u0001\u00a8\u0006+"}, d2 = {"Lcom/yoga/dict/data/repository/AsanaRepository;", "", "apiService", "Lcom/yoga/dict/data/api/DictApiService;", "(Lcom/yoga/dict/data/api/DictApiService;)V", "encodeURIComponent", "", "input", "getAllAsanas", "Lkotlin/Result;", "", "Lcom/yoga/dict/data/model/Asana;", "getAllAsanas-IoAF18A", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getAsanaById", "id", "getAsanaById-gIAlu-s", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getAsanasByLetter", "letter", "getAsanasByLetter-gIAlu-s", "getAsanasBySource", "sourceId", "getAsanasBySource-gIAlu-s", "getSimilarAsanas", "asanaId", "getSimilarAsanas-gIAlu-s", "getSources", "Lcom/yoga/dict/data/model/Source;", "getSources-IoAF18A", "removeSameAsObject", "", "targetAsanaId", "removeSameAsObject-0E7RQCE", "(Ljava/lang/String;Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "searchAsanas", "query", "fuzzy", "", "searchAsanas-0E7RQCE", "(Ljava/lang/String;ZLkotlin/coroutines/Continuation;)Ljava/lang/Object;", "setSameAsObject", "setSameAsObject-0E7RQCE", "app_debug"})
public final class AsanaRepository {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.api.DictApiService apiService = null;
    
    @javax.inject.Inject()
    public AsanaRepository(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.DictApiService apiService) {
        super();
    }
    
    private final java.lang.String encodeURIComponent(java.lang.String input) {
        return null;
    }
}