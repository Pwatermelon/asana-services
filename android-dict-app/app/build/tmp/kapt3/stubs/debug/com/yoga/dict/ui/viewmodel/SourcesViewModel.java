package com.yoga.dict.ui.viewmodel;

import androidx.lifecycle.ViewModel;
import com.yoga.dict.data.model.Source;
import com.yoga.dict.data.repository.AsanaRepository;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000>\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u000e\u0010\u0012\u001a\u00020\u00132\u0006\u0010\u0014\u001a\u00020\u0015J\u0006\u0010\u0016\u001a\u00020\u0013R\u0014\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\b\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001a\u0010\t\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\f\u001a\b\u0012\u0004\u0012\u00020\u00070\r\u00a2\u0006\b\n\u0000\u001a\u0004\b\f\u0010\u000eR\u0017\u0010\u000f\u001a\b\u0012\u0004\u0012\u00020\u00070\r\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u000eR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001d\u0010\u0010\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u000b0\n0\r\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u000e\u00a8\u0006\u0017"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/SourcesViewModel;", "Landroidx/lifecycle/ViewModel;", "repository", "Lcom/yoga/dict/data/repository/AsanaRepository;", "(Lcom/yoga/dict/data/repository/AsanaRepository;)V", "_isExpertOrAdmin", "Lkotlinx/coroutines/flow/MutableStateFlow;", "", "_isLoading", "_sources", "", "Lcom/yoga/dict/data/model/Source;", "isExpertOrAdmin", "Lkotlinx/coroutines/flow/StateFlow;", "()Lkotlinx/coroutines/flow/StateFlow;", "isLoading", "sources", "getSources", "deleteSource", "", "sourceId", "", "loadSources", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class SourcesViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.repository.AsanaRepository repository = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.util.List<com.yoga.dict.data.model.Source>> _sources = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.Source>> sources = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.Boolean> _isLoading = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isLoading = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.Boolean> _isExpertOrAdmin = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isExpertOrAdmin = null;
    
    @javax.inject.Inject()
    public SourcesViewModel(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.repository.AsanaRepository repository) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.Source>> getSources() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isLoading() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.Boolean> isExpertOrAdmin() {
        return null;
    }
    
    public final void loadSources() {
    }
    
    public final void deleteSource(@org.jetbrains.annotations.NotNull()
    java.lang.String sourceId) {
    }
}