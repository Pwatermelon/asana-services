package com.yoga.dict.ui.viewmodel;

import androidx.lifecycle.ViewModel;
import com.yoga.dict.data.api.AsanaNameCreate;
import com.yoga.dict.data.model.AsanaName;
import com.yoga.dict.data.repository.AsanaManagementRepository;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import java.io.File;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000L\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0010\u0002\n\u0002\b\r\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\t\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u008c\u0001\u0010\u0014\u001a\u00020\u00152\b\u0010\u0016\u001a\u0004\u0018\u00010\n2\b\u0010\u0017\u001a\u0004\u0018\u00010\n2\b\u0010\u0018\u001a\u0004\u0018\u00010\n2\b\u0010\u0019\u001a\u0004\u0018\u00010\n2\b\u0010\u001a\u001a\u0004\u0018\u00010\n2\b\u0010\u001b\u001a\u0004\u0018\u00010\n2\b\u0010\u001c\u001a\u0004\u0018\u00010\n2\b\u0010\u001d\u001a\u0004\u0018\u00010\n2\b\u0010\u001e\u001a\u0004\u0018\u00010\n2\b\u0010\u001f\u001a\u0004\u0018\u00010\n2\b\u0010 \u001a\u0004\u0018\u00010\n2\b\u0010!\u001a\u0004\u0018\u00010\n2\f\u0010\"\u001a\b\u0012\u0004\u0012\u00020#0\u0007J\u000e\u0010$\u001a\u00020\u00152\u0006\u0010%\u001a\u00020&J>\u0010\'\u001a\u00020\u00152\u0006\u0010(\u001a\u00020\n2\u0006\u0010)\u001a\u00020\n2\b\u0010*\u001a\u0004\u0018\u00010\n2\b\u0010+\u001a\u0004\u0018\u00010\n2\b\u0010,\u001a\u0004\u0018\u00010\n2\b\u0010-\u001a\u0004\u0018\u00010\nJ\u0006\u0010.\u001a\u00020\u0015R\u001a\u0010\u0005\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\t\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\f0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001d\u0010\r\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u000e\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010R\u0019\u0010\u0011\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u000e\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0012\u0010\u0010R\u0017\u0010\u0013\u001a\b\u0012\u0004\u0012\u00020\f0\u000e\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0013\u0010\u0010R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006/"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AsanaManagementViewModel;", "Landroidx/lifecycle/ViewModel;", "repository", "Lcom/yoga/dict/data/repository/AsanaManagementRepository;", "(Lcom/yoga/dict/data/repository/AsanaManagementRepository;)V", "_asanaNames", "Lkotlinx/coroutines/flow/MutableStateFlow;", "", "Lcom/yoga/dict/data/model/AsanaName;", "_error", "", "_isLoading", "", "asanaNames", "Lkotlinx/coroutines/flow/StateFlow;", "getAsanaNames", "()Lkotlinx/coroutines/flow/StateFlow;", "error", "getError", "isLoading", "addAsana", "", "selectedName", "newNameRu", "newNameSanskrit", "transliteration", "definition", "selectedSource", "newSourceTitle", "newSourceAuthor", "newSourceYear", "newSourcePublisher", "newSourcePages", "newSourceAnnotation", "photos", "Ljava/io/File;", "addAsanaName", "name", "Lcom/yoga/dict/data/api/AsanaNameCreate;", "addSource", "title", "author", "year", "publisher", "pages", "annotation", "loadAsanaNames", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class AsanaManagementViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.repository.AsanaManagementRepository repository = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.util.List<com.yoga.dict.data.model.AsanaName>> _asanaNames = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.AsanaName>> asanaNames = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.Boolean> _isLoading = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isLoading = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _error = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> error = null;
    
    @javax.inject.Inject()
    public AsanaManagementViewModel(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.repository.AsanaManagementRepository repository) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.AsanaName>> getAsanaNames() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isLoading() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getError() {
        return null;
    }
    
    public final void loadAsanaNames() {
    }
    
    public final void addAsanaName(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.api.AsanaNameCreate name) {
    }
    
    public final void addAsana(@org.jetbrains.annotations.Nullable()
    java.lang.String selectedName, @org.jetbrains.annotations.Nullable()
    java.lang.String newNameRu, @org.jetbrains.annotations.Nullable()
    java.lang.String newNameSanskrit, @org.jetbrains.annotations.Nullable()
    java.lang.String transliteration, @org.jetbrains.annotations.Nullable()
    java.lang.String definition, @org.jetbrains.annotations.Nullable()
    java.lang.String selectedSource, @org.jetbrains.annotations.Nullable()
    java.lang.String newSourceTitle, @org.jetbrains.annotations.Nullable()
    java.lang.String newSourceAuthor, @org.jetbrains.annotations.Nullable()
    java.lang.String newSourceYear, @org.jetbrains.annotations.Nullable()
    java.lang.String newSourcePublisher, @org.jetbrains.annotations.Nullable()
    java.lang.String newSourcePages, @org.jetbrains.annotations.Nullable()
    java.lang.String newSourceAnnotation, @org.jetbrains.annotations.NotNull()
    java.util.List<? extends java.io.File> photos) {
    }
    
    public final void addSource(@org.jetbrains.annotations.NotNull()
    java.lang.String title, @org.jetbrains.annotations.NotNull()
    java.lang.String author, @org.jetbrains.annotations.Nullable()
    java.lang.String year, @org.jetbrains.annotations.Nullable()
    java.lang.String publisher, @org.jetbrains.annotations.Nullable()
    java.lang.String pages, @org.jetbrains.annotations.Nullable()
    java.lang.String annotation) {
    }
}