package com.yoga.dict.ui.viewmodel;

import androidx.lifecycle.ViewModel;
import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.repository.AsanaRepository;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000T\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0010$\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u000f\n\u0002\u0010\u0002\n\u0002\b\u0010\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0006\u0010#\u001a\u00020$J\u000e\u0010%\u001a\u00020$2\u0006\u0010&\u001a\u00020\u000bJ\u001c\u0010\'\u001a\b\u0012\u0004\u0012\u00020\b0\u00072\u0006\u0010(\u001a\u00020\u000bH\u0086@\u00a2\u0006\u0002\u0010)J\u0016\u0010*\u001a\u00020$2\f\u0010+\u001a\b\u0012\u0004\u0012\u00020\b0\u0007H\u0002J\u000e\u0010,\u001a\u00020$2\u0006\u0010-\u001a\u00020\u000bJ\u0006\u0010.\u001a\u00020$J\u000e\u0010/\u001a\u00020$2\u0006\u00100\u001a\u00020\u000bJ\u0010\u00101\u001a\u00020$2\u0006\u0010(\u001a\u00020\u000bH\u0002J0\u00102\u001a\u00020$2\u0006\u00103\u001a\u00020\u000b2\f\u00104\u001a\b\u0012\u0004\u0012\u00020$052\u0012\u00106\u001a\u000e\u0012\u0004\u0012\u00020\u000b\u0012\u0004\u0012\u00020$07J\u000e\u00108\u001a\u00020$2\u0006\u00109\u001a\u00020\u000bJ\u000e\u0010:\u001a\u00020$2\u0006\u0010;\u001a\u00020\bJ0\u0010<\u001a\u00020$2\u0006\u00103\u001a\u00020\u000b2\f\u00104\u001a\b\u0012\u0004\u0012\u00020$052\u0012\u00106\u001a\u000e\u0012\u0004\u0012\u00020\u000b\u0012\u0004\u0012\u00020$07R\u001a\u0010\u0005\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R \u0010\t\u001a\u0014\u0012\u0010\u0012\u000e\u0012\u0004\u0012\u00020\u000b\u0012\u0004\u0012\u00020\f0\n0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\r\u001a\b\u0012\u0004\u0012\u00020\u000b0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\u000e\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\b0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\u000f\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\u000b0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001a\u0010\u0010\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\u00120\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001d\u0010\u0013\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0015\u0010\u0016R#\u0010\u0017\u001a\u0014\u0012\u0010\u0012\u000e\u0012\u0004\u0012\u00020\u000b\u0012\u0004\u0012\u00020\f0\n0\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0018\u0010\u0016R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\u0019\u001a\b\u0012\u0004\u0012\u00020\u000b0\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001a\u0010\u0016R\u0019\u0010\u001b\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\b0\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001c\u0010\u0016R\u0019\u0010\u001d\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\u000b0\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001e\u0010\u0016R\u001d\u0010\u001f\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b \u0010\u0016R\u0017\u0010!\u001a\b\u0012\u0004\u0012\u00020\u00120\u0014\u00a2\u0006\b\n\u0000\u001a\u0004\b\"\u0010\u0016\u00a8\u0006="}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AsanaViewModel;", "Landroidx/lifecycle/ViewModel;", "repository", "Lcom/yoga/dict/data/repository/AsanaRepository;", "(Lcom/yoga/dict/data/repository/AsanaRepository;)V", "_asanaList", "Lkotlinx/coroutines/flow/MutableStateFlow;", "", "Lcom/yoga/dict/data/model/Asana;", "_groupedAsanasByName", "", "", "Lcom/yoga/dict/ui/viewmodel/AsanaNameGroup;", "_searchQuery", "_selectedAsana", "_selectedLetter", "_similarAsanas", "_uiState", "Lcom/yoga/dict/ui/viewmodel/AsanaUiState;", "asanaList", "Lkotlinx/coroutines/flow/StateFlow;", "getAsanaList", "()Lkotlinx/coroutines/flow/StateFlow;", "groupedAsanasByName", "getGroupedAsanasByName", "searchQuery", "getSearchQuery", "selectedAsana", "getSelectedAsana", "selectedLetter", "getSelectedLetter", "similarAsanas", "getSimilarAsanas", "uiState", "getUiState", "clearFilters", "", "filterByLetter", "letter", "getSimilarAsanasForAsana", "asanaId", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "groupAsanasByName", "asanas", "loadAsanaById", "id", "loadAsanas", "loadAsanasBySource", "sourceId", "loadSimilarAsanas", "removeSameAsObject", "targetAsanaId", "onSuccess", "Lkotlin/Function0;", "onError", "Lkotlin/Function1;", "searchAsanas", "query", "selectAsana", "asana", "setSameAsObject", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class AsanaViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.yoga.dict.data.repository.AsanaRepository repository = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<com.yoga.dict.ui.viewmodel.AsanaUiState> _uiState = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<com.yoga.dict.ui.viewmodel.AsanaUiState> uiState = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.util.List<com.yoga.dict.data.model.Asana>> _asanaList = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.Asana>> asanaList = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<com.yoga.dict.data.model.Asana> _selectedAsana = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<com.yoga.dict.data.model.Asana> selectedAsana = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.util.List<com.yoga.dict.data.model.Asana>> _similarAsanas = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.Asana>> similarAsanas = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _searchQuery = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> searchQuery = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _selectedLetter = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> selectedLetter = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.util.Map<java.lang.String, com.yoga.dict.ui.viewmodel.AsanaNameGroup>> _groupedAsanasByName = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.util.Map<java.lang.String, com.yoga.dict.ui.viewmodel.AsanaNameGroup>> groupedAsanasByName = null;
    
    @javax.inject.Inject()
    public AsanaViewModel(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.repository.AsanaRepository repository) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<com.yoga.dict.ui.viewmodel.AsanaUiState> getUiState() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.Asana>> getAsanaList() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<com.yoga.dict.data.model.Asana> getSelectedAsana() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.util.List<com.yoga.dict.data.model.Asana>> getSimilarAsanas() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getSearchQuery() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getSelectedLetter() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.util.Map<java.lang.String, com.yoga.dict.ui.viewmodel.AsanaNameGroup>> getGroupedAsanasByName() {
        return null;
    }
    
    public final void loadAsanas() {
    }
    
    private final void groupAsanasByName(java.util.List<com.yoga.dict.data.model.Asana> asanas) {
    }
    
    public final void loadAsanaById(@org.jetbrains.annotations.NotNull()
    java.lang.String id) {
    }
    
    private final void loadSimilarAsanas(java.lang.String asanaId) {
    }
    
    @org.jetbrains.annotations.Nullable()
    public final java.lang.Object getSimilarAsanasForAsana(@org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.util.List<com.yoga.dict.data.model.Asana>> $completion) {
        return null;
    }
    
    public final void searchAsanas(@org.jetbrains.annotations.NotNull()
    java.lang.String query) {
    }
    
    public final void filterByLetter(@org.jetbrains.annotations.NotNull()
    java.lang.String letter) {
    }
    
    public final void loadAsanasBySource(@org.jetbrains.annotations.NotNull()
    java.lang.String sourceId) {
    }
    
    public final void clearFilters() {
    }
    
    public final void selectAsana(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.Asana asana) {
    }
    
    public final void setSameAsObject(@org.jetbrains.annotations.NotNull()
    java.lang.String targetAsanaId, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onSuccess, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onError) {
    }
    
    public final void removeSameAsObject(@org.jetbrains.annotations.NotNull()
    java.lang.String targetAsanaId, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onSuccess, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onError) {
    }
}