package com.yoga.dict.data.repository;

import com.yoga.dict.data.api.DictApiService;
import com.yoga.dict.data.api.ModerationItem;
import okhttp3.MultipartBody;
import java.io.File;
import javax.inject.Inject;
import javax.inject.Singleton;

@javax.inject.Singleton()
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000L\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\b\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004JD\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u00062\u0006\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\u000b2\u000e\u0010\r\u001a\n\u0012\u0004\u0012\u00020\u000f\u0018\u00010\u000eH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0010\u0010\u0011J\u001c\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00130\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u0014\u0010\u0015J.\u0010\u0016\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00170\u000e0\u00062\n\b\u0002\u0010\u0018\u001a\u0004\u0018\u00010\u0019H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001a\u0010\u001bJ\u001c\u0010\u001c\u001a\b\u0012\u0004\u0012\u00020\t0\u0006H\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001d\u0010\u0015J$\u0010\u001e\u001a\b\u0012\u0004\u0012\u00020\u00070\u00062\u0006\u0010\b\u001a\u00020\tH\u0086@\u00f8\u0001\u0000\u00f8\u0001\u0001\u00a2\u0006\u0004\b\u001f\u0010 R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u0082\u0002\u000b\n\u0002\b!\n\u0005\b\u00a1\u001e0\u0001\u00a8\u0006!"}, d2 = {"Lcom/yoga/dict/data/repository/ModerationRepository;", "", "apiService", "Lcom/yoga/dict/data/api/DictApiService;", "(Lcom/yoga/dict/data/api/DictApiService;)V", "addAsanaFromModeration", "Lkotlin/Result;", "", "itemId", "", "nameId", "", "sourceId", "photos", "", "Ljava/io/File;", "addAsanaFromModeration-yxL6bBk", "(ILjava/lang/String;Ljava/lang/String;Ljava/util/List;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "exportModerationItems", "Lokhttp3/ResponseBody;", "exportModerationItems-IoAF18A", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getModerationItems", "Lcom/yoga/dict/data/api/ModerationItem;", "resolved", "", "getModerationItems-gIAlu-s", "(Ljava/lang/Boolean;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getModerationItemsCount", "getModerationItemsCount-IoAF18A", "resolveModerationItem", "resolveModerationItem-gIAlu-s", "(ILkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public final class ModerationRepository {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.api.DictApiService apiService = null;
    
    @javax.inject.Inject()
    public ModerationRepository(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.DictApiService apiService) {
        super();
    }
}