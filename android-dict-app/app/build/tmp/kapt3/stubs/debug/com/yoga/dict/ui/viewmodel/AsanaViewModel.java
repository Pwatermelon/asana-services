package com.yoga.dict.ui.viewmodel;

import androidx.lifecycle.ViewModel;
import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.repository.AsanaRepository;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000>\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u000b\n\u0002\u0010\u0002\n\u0002\b\n\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0006\u0010\u001b\u001a\u00020\u001cJ\u000e\u0010\u001d\u001a\u00020\u001c2\u0006\u0010\u001e\u001a\u00020\nJ\u000e\u0010\u001f\u001a\u00020\u001c2\u0006\u0010 \u001a\u00020\nJ\u0006\u0010!\u001a\u00020\u001cJ\u000e\u0010\"\u001a\u00020\u001c2\u0006\u0010#\u001a\u00020\nJ\u000e\u0010$\u001a\u00020\u001c2\u0006\u0010%\u001a\u00020\bR\u001a\u0010\u0005\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\t\u001a\b\u0012\u0004\u0012\u00020\n0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\u000b\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\b0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0016\u0010\f\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\r\u001a\b\u0012\u0004\u0012\u00020\u000e0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001d\u0010\u000f\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\b0\u00070\u0010\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0012R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\u0013\u001a\b\u0012\u0004\u0012\u00020\n0\u0010\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0014\u0010\u0012R\u0019\u0010\u0015\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\b0\u0010\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0016\u0010\u0012R\u0019\u0010\u0017\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\n0\u0010\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0018\u0010\u0012R\u0017\u0010\u0019\u001a\b\u0012\u0004\u0012\u00020\u000e0\u0010\u00a2\u0006\b\n\u0000\u001a\u0004\b\u001a\u0010\u0012\u00a8\u0006&"}, d2 = {"Lcom/yoga/dict/ui/viewmodel/AsanaViewModel;", "Landroidx/lifecycle/ViewModel;", "repository", "Lcom/yoga/dict/data/repository/AsanaRepository;", "(Lcom/yoga/dict/data/repository/AsanaRepository;)V", "_asanaList", "Lkotlinx/coroutines/flow/MutableStateFlow;", "", "Lcom/yoga/dict/data/model/Asana;", "_searchQuery", "", "_selectedAsana", "_selectedLetter", "_uiState", "Lcom/yoga/dict/ui/viewmodel/AsanaUiState;", "asanaList", "Lkotlinx/coroutines/flow/StateFlow;", "getAsanaList", "()Lkotlinx/coroutines/flow/StateFlow;", "searchQuery", "getSearchQuery", "selectedAsana", "getSelectedAsana", "selectedLetter", "getSelectedLetter", "uiState", "getUiState", "clearFilters", "", "filterByLetter", "letter", "loadAsanaById", "id", "loadAsanas", "searchAsanas", "query", "selectAsana", "asana", "app_debug"})
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
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _searchQuery = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> searchQuery = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _selectedLetter = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> selectedLetter = null;
    
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
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getSearchQuery() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getSelectedLetter() {
        return null;
    }
    
    public final void loadAsanas() {
    }
    
    public final void loadAsanaById(@org.jetbrains.annotations.NotNull()
    java.lang.String id) {
    }
    
    public final void searchAsanas(@org.jetbrains.annotations.NotNull()
    java.lang.String query) {
    }
    
    public final void filterByLetter(@org.jetbrains.annotations.NotNull()
    java.lang.String letter) {
    }
    
    public final void clearFilters() {
    }
    
    public final void selectAsana(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.Asana asana) {
    }
}