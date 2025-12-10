package com.yoga.dict.data.repository;

import com.yoga.dict.data.api.DictApiService;
import com.yoga.dict.data.api.TextContentRequest;
import javax.inject.Inject;
import javax.inject.Singleton;

@javax.inject.Singleton()
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\b\u0005\n\u0002\u0010\u0002\n\u0002\b\u0006\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u001c\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\b\u0010\tJ\u001c\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u000b\u0010\tJ$\u0010\f\u001a\b\u0012\u0004\u0012\u00020\r0\u00062\u0006\u0010\u000e\u001a\u00020\u0007H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u000f\u0010\u0010J$\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\r0\u00062\u0006\u0010\u000e\u001a\u00020\u0007H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0012\u0010\u0010R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u0082\u0002\u000b\n\u0002\b!\n\u0005\b\u00a1\u001e0\u0001\u00a8\u0006\u0013"}, d2 = {"Lcom/yoga/dict/data/repository/ContentRepository;", "", "apiService", "Lcom/yoga/dict/data/api/DictApiService;", "(Lcom/yoga/dict/data/api/DictApiService;)V", "getAboutProject", "Lkotlin/Result;", "", "getAboutProject-IoAF18A", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getExpertInstructions", "getExpertInstructions-IoAF18A", "updateAboutProject", "", "content", "updateAboutProject-gIAlu-s", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "updateExpertInstructions", "updateExpertInstructions-gIAlu-s", "app_debug"})
public final class ContentRepository {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.api.DictApiService apiService = null;
    
    @javax.inject.Inject()
    public ContentRepository(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.DictApiService apiService) {
        super();
    }
}