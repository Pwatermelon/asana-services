package com.yoga.dict.data.api;

import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.Source;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import retrofit2.Response;
import retrofit2.http.*;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u00b2\u0001\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\f\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\b\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\r\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\f\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0006\bf\u0018\u00002\u00020\u0001J\u00b0\u0001\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0005\u001a\u00020\u00062\n\b\u0001\u0010\u0007\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\b\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\t\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\n\u001a\u0004\u0018\u00010\u00062\b\b\u0001\u0010\u000b\u001a\u00020\u00062\n\b\u0001\u0010\f\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\r\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\u000e\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\u000f\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\u0010\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010\u0011\u001a\u0004\u0018\u00010\u00062\u000e\b\u0001\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00140\u0013H\u00a7@\u00a2\u0006\u0002\u0010\u0015JD\u0010\u0016\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0017\u001a\u00020\u00182\b\b\u0001\u0010\u0019\u001a\u00020\u00062\b\b\u0001\u0010\u001a\u001a\u00020\u00062\u0010\b\u0001\u0010\u0012\u001a\n\u0012\u0004\u0012\u00020\u0014\u0018\u00010\u0013H\u00a7@\u00a2\u0006\u0002\u0010\u001bJ\u001e\u0010\u001c\u001a\b\u0012\u0004\u0012\u00020\u001d0\u00032\b\b\u0001\u0010\u001e\u001a\u00020\u001fH\u00a7@\u00a2\u0006\u0002\u0010 J8\u0010!\u001a\b\u0012\u0004\u0012\u00020\"0\u00032\b\b\u0001\u0010#\u001a\u00020$2\b\b\u0001\u0010\u001a\u001a\u00020\u00062\u000e\b\u0001\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00140\u0013H\u00a7@\u00a2\u0006\u0002\u0010%JX\u0010&\u001a\b\u0012\u0004\u0012\u00020\'0\u00032\b\b\u0001\u0010(\u001a\u00020\u00062\b\b\u0001\u0010)\u001a\u00020\u00062\n\b\u0001\u0010*\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010+\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010,\u001a\u0004\u0018\u00010\u00062\n\b\u0001\u0010-\u001a\u0004\u0018\u00010\u0006H\u00a7@\u00a2\u0006\u0002\u0010.J\u001e\u0010/\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u00100\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J\u001e\u00102\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u00100\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J\u001e\u00103\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u00100\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J\u0014\u00104\u001a\b\u0012\u0004\u0012\u0002050\u0003H\u00a7@\u00a2\u0006\u0002\u00106J \u00107\u001a\b\u0012\u0004\u0012\u0002050\u00032\n\b\u0003\u00108\u001a\u0004\u0018\u000109H\u00a7@\u00a2\u0006\u0002\u0010:J\u0014\u0010;\u001a\b\u0012\u0004\u0012\u00020<0\u0003H\u00a7@\u00a2\u0006\u0002\u00106J\u001e\u0010=\u001a\b\u0012\u0004\u0012\u00020>0\u00032\b\b\u0001\u0010#\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J\u001a\u0010?\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020@0\u00130\u0003H\u00a7@\u00a2\u0006\u0002\u00106J\u001a\u0010A\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020>0\u00130\u0003H\u00a7@\u00a2\u0006\u0002\u00106J$\u0010B\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020>0\u00130\u00032\b\b\u0001\u0010C\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J$\u0010D\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020>0\u00130\u00032\b\b\u0001\u0010\u001a\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J\u0014\u0010E\u001a\b\u0012\u0004\u0012\u00020<0\u0003H\u00a7@\u00a2\u0006\u0002\u00106J\u001e\u0010F\u001a\b\u0012\u0004\u0012\u00020G0\u00032\b\b\u0001\u0010H\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J&\u0010I\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020J0\u00130\u00032\n\b\u0003\u00108\u001a\u0004\u0018\u000109H\u00a7@\u00a2\u0006\u0002\u0010:J\u0014\u0010K\u001a\b\u0012\u0004\u0012\u00020L0\u0003H\u00a7@\u00a2\u0006\u0002\u00106J(\u0010M\u001a\b\u0012\u0004\u0012\u00020N0\u00032\b\b\u0001\u0010#\u001a\u00020$2\b\b\u0001\u0010\u001a\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u0010OJ$\u0010P\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020>0\u00130\u00032\b\b\u0001\u0010#\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u00101J\u001a\u0010Q\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020R0\u00130\u0003H\u00a7@\u00a2\u0006\u0002\u00106J(\u0010S\u001a\b\u0012\u0004\u0012\u00020T0\u00032\b\b\u0001\u0010\u001a\u001a\u00020\u00062\b\b\u0001\u0010U\u001a\u00020\u0014H\u00a7@\u00a2\u0006\u0002\u0010VJ(\u0010W\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010#\u001a\u00020$2\b\b\u0001\u0010X\u001a\u00020$H\u00a7@\u00a2\u0006\u0002\u0010OJ\u001e\u0010Y\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0017\u001a\u00020\u0018H\u00a7@\u00a2\u0006\u0002\u0010ZJ.\u0010[\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020>0\u00130\u00032\b\b\u0001\u0010\\\u001a\u00020$2\b\b\u0003\u0010]\u001a\u000209H\u00a7@\u00a2\u0006\u0002\u0010^J(\u0010_\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010#\u001a\u00020$2\b\b\u0001\u0010`\u001a\u00020aH\u00a7@\u00a2\u0006\u0002\u0010bJ\u001e\u0010c\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010d\u001a\u00020eH\u00a7@\u00a2\u0006\u0002\u0010fJ\u001e\u0010g\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010d\u001a\u00020eH\u00a7@\u00a2\u0006\u0002\u0010fJ\u001e\u0010h\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010i\u001a\u00020\u0014H\u00a7@\u00a2\u0006\u0002\u0010j\u00f8\u0001\u0000\u0082\u0002\u0006\n\u0004\b!0\u0001\u00a8\u0006k\u00c0\u0006\u0001"}, d2 = {"Lcom/yoga/dict/data/api/DictApiService;", "", "addAsana", "Lretrofit2/Response;", "Lcom/yoga/dict/data/api/MessageResponse;", "selectedName", "Lokhttp3/RequestBody;", "newNameRu", "newNameSanskrit", "transliteration", "definition", "selectedSource", "newSourceTitle", "newSourceAuthor", "newSourceYear", "newSourcePublisher", "newSourcePages", "newSourceAnnotation", "photos", "", "Lokhttp3/MultipartBody$Part;", "(Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Ljava/util/List;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "addAsanaFromModeration", "itemId", "", "nameId", "sourceId", "(ILokhttp3/RequestBody;Lokhttp3/RequestBody;Ljava/util/List;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "addAsanaName", "Lcom/yoga/dict/data/api/AsanaNameResponse;", "name", "Lcom/yoga/dict/data/api/AsanaNameCreate;", "(Lcom/yoga/dict/data/api/AsanaNameCreate;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "addPhotoToAsana", "Lcom/yoga/dict/data/api/PhotoAddResponse;", "asanaId", "", "(Ljava/lang/String;Lokhttp3/RequestBody;Ljava/util/List;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "addSource", "Lcom/yoga/dict/data/api/SourceResponse;", "title", "author", "year", "publisher", "pages", "annotation", "(Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "deleteAsana", "uri", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "deleteAsanaName", "deleteSource", "downloadOntology", "Lokhttp3/ResponseBody;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "exportModerationItems", "resolved", "", "(Ljava/lang/Boolean;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getAboutProject", "Lcom/yoga/dict/data/api/TextContentResponse;", "getAsanaById", "Lcom/yoga/dict/data/model/Asana;", "getAsanaNames", "Lcom/yoga/dict/data/model/AsanaName;", "getAsanas", "getAsanasByLetter", "letter", "getAsanasBySource", "getExpertInstructions", "getImportStatus", "Lcom/yoga/dict/data/api/ImportStatusResponse;", "taskId", "getModerationItems", "Lcom/yoga/dict/data/api/ModerationItem;", "getModerationItemsCount", "Lcom/yoga/dict/data/api/ModerationCountResponse;", "getPhotoOfAsanaFromSource", "Lcom/yoga/dict/data/model/AsanaPhoto;", "(Ljava/lang/String;Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getSimilarAsanas", "getSources", "Lcom/yoga/dict/data/model/Source;", "importAsanas", "Lcom/yoga/dict/data/api/ImportTaskResponse;", "excelFile", "(Lokhttp3/RequestBody;Lokhttp3/MultipartBody$Part;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "removeSameAsObject", "targetAsanaId", "resolveModerationItem", "(ILkotlin/coroutines/Continuation;)Ljava/lang/Object;", "searchAsanas", "query", "fuzzy", "(Ljava/lang/String;ZLkotlin/coroutines/Continuation;)Ljava/lang/Object;", "setSameAsObject", "request", "Lcom/yoga/dict/data/api/SameAsRequest;", "(Ljava/lang/String;Lcom/yoga/dict/data/api/SameAsRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "updateAboutProject", "content", "Lcom/yoga/dict/data/api/TextContentRequest;", "(Lcom/yoga/dict/data/api/TextContentRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "updateExpertInstructions", "uploadOntology", "ontologyFile", "(Lokhttp3/MultipartBody$Part;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public abstract interface DictApiService {
    
    @retrofit2.http.GET(value = "api/asanas")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanas(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Asana>>> $completion);
    
    @retrofit2.http.GET(value = "api/asana/{asana_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanaById(@retrofit2.http.Path(value = "asana_id", encoded = true)
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
    public abstract java.lang.Object getAsanasBySource(@retrofit2.http.Path(value = "source_id", encoded = true)
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
    
    @retrofit2.http.POST(value = "api/asana")
    @retrofit2.http.Multipart()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object addAsana(@retrofit2.http.Part(value = "selected_name")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody selectedName, @retrofit2.http.Part(value = "new_name_ru")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newNameRu, @retrofit2.http.Part(value = "new_name_sanskrit")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newNameSanskrit, @retrofit2.http.Part(value = "transliteration")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody transliteration, @retrofit2.http.Part(value = "definition")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody definition, @retrofit2.http.Part(value = "selected_source")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody selectedSource, @retrofit2.http.Part(value = "new_source_title")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newSourceTitle, @retrofit2.http.Part(value = "new_source_author")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newSourceAuthor, @retrofit2.http.Part(value = "new_source_year")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newSourceYear, @retrofit2.http.Part(value = "new_source_publisher")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newSourcePublisher, @retrofit2.http.Part(value = "new_source_pages")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newSourcePages, @retrofit2.http.Part(value = "new_source_annotation")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody newSourceAnnotation, @retrofit2.http.Part()
    @org.jetbrains.annotations.NotNull()
    java.util.List<okhttp3.MultipartBody.Part> photos, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.DELETE(value = "api/asanas")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object deleteAsana(@retrofit2.http.Query(value = "uri")
    @org.jetbrains.annotations.NotNull()
    java.lang.String uri, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/asana/{asana_id}/add-photo")
    @retrofit2.http.Multipart()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object addPhotoToAsana(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @retrofit2.http.Part(value = "source_id")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody sourceId, @retrofit2.http.Part()
    @org.jetbrains.annotations.NotNull()
    java.util.List<okhttp3.MultipartBody.Part> photos, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.PhotoAddResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/asana/{asana_id}/photo-by-source/{source_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getPhotoOfAsanaFromSource(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @retrofit2.http.Path(value = "source_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String sourceId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.model.AsanaPhoto>> $completion);
    
    @retrofit2.http.GET(value = "api/asana/{asana_id}/similar")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getSimilarAsanas(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Asana>>> $completion);
    
    @retrofit2.http.POST(value = "api/asana/{asana_id}/same-as")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object setSameAsObject(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.SameAsRequest request, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.DELETE(value = "api/asana/{asana_id}/same-as/{target_asana_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object removeSameAsObject(@retrofit2.http.Path(value = "asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @retrofit2.http.Path(value = "target_asana_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String targetAsanaId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/sources")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getSources(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.Source>>> $completion);
    
    @retrofit2.http.POST(value = "api/sources")
    @retrofit2.http.Multipart()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object addSource(@retrofit2.http.Part(value = "title")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody title, @retrofit2.http.Part(value = "author")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody author, @retrofit2.http.Part(value = "year")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody year, @retrofit2.http.Part(value = "publisher")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody publisher, @retrofit2.http.Part(value = "pages")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody pages, @retrofit2.http.Part(value = "annotation")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody annotation, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.SourceResponse>> $completion);
    
    @retrofit2.http.DELETE(value = "api/delete-source")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object deleteSource(@retrofit2.http.Query(value = "uri")
    @org.jetbrains.annotations.NotNull()
    java.lang.String uri, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/asana-names")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAsanaNames(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.model.AsanaName>>> $completion);
    
    @retrofit2.http.POST(value = "api/asana-names")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object addAsanaName(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.AsanaNameCreate name, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.AsanaNameResponse>> $completion);
    
    @retrofit2.http.DELETE(value = "api/delete-asana-name")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object deleteAsanaName(@retrofit2.http.Query(value = "uri")
    @org.jetbrains.annotations.NotNull()
    java.lang.String uri, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/moderation/items")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getModerationItems(@retrofit2.http.Query(value = "resolved")
    @org.jetbrains.annotations.Nullable()
    java.lang.Boolean resolved, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.util.List<com.yoga.dict.data.api.ModerationItem>>> $completion);
    
    @retrofit2.http.GET(value = "api/moderation/items/count")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getModerationItemsCount(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.ModerationCountResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/moderation/items/export")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object exportModerationItems(@retrofit2.http.Query(value = "resolved")
    @org.jetbrains.annotations.Nullable()
    java.lang.Boolean resolved, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<okhttp3.ResponseBody>> $completion);
    
    @retrofit2.http.POST(value = "api/moderation/items/{item_id}/add-asana")
    @retrofit2.http.Multipart()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object addAsanaFromModeration(@retrofit2.http.Path(value = "item_id")
    int itemId, @retrofit2.http.Part(value = "name_id")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody nameId, @retrofit2.http.Part(value = "source_id")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody sourceId, @retrofit2.http.Part()
    @org.jetbrains.annotations.Nullable()
    java.util.List<okhttp3.MultipartBody.Part> photos, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/moderation/items/{item_id}/resolve")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object resolveModerationItem(@retrofit2.http.Path(value = "item_id")
    int itemId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/about-project")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getAboutProject(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.TextContentResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/about-project")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object updateAboutProject(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.TextContentRequest content, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/expert-instructions")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getExpertInstructions(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.TextContentResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/expert-instructions")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object updateExpertInstructions(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.TextContentRequest content, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/download-ontology")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object downloadOntology(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<okhttp3.ResponseBody>> $completion);
    
    @retrofit2.http.POST(value = "api/upload-ontology")
    @retrofit2.http.Multipart()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object uploadOntology(@retrofit2.http.Part()
    @org.jetbrains.annotations.NotNull()
    okhttp3.MultipartBody.Part ontologyFile, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.MessageResponse>> $completion);
    
    @retrofit2.http.POST(value = "api/import/asanas")
    @retrofit2.http.Multipart()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object importAsanas(@retrofit2.http.Part(value = "source_id")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody sourceId, @retrofit2.http.Part()
    @org.jetbrains.annotations.NotNull()
    okhttp3.MultipartBody.Part excelFile, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.ImportTaskResponse>> $completion);
    
    @retrofit2.http.GET(value = "api/import/status/{task_id}")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getImportStatus(@retrofit2.http.Path(value = "task_id")
    @org.jetbrains.annotations.NotNull()
    java.lang.String taskId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.yoga.dict.data.api.ImportStatusResponse>> $completion);
}