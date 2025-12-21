package com.yoga.dict.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yoga.dict.data.api.AsanaNameCreate
import com.yoga.dict.data.model.AsanaName
import com.yoga.dict.data.repository.AsanaManagementRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class AsanaManagementViewModel @Inject constructor(
    private val repository: AsanaManagementRepository
) : ViewModel() {
    
    private val _asanaNames = MutableStateFlow<List<AsanaName>>(emptyList())
    val asanaNames: StateFlow<List<AsanaName>> = _asanaNames.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    init {
        loadAsanaNames()
    }
    
    fun loadAsanaNames() {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getAsanaNames()
                .onSuccess { names ->
                    _asanaNames.value = names
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun addAsanaName(name: AsanaNameCreate) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.addAsanaName(name)
                .onSuccess {
                    loadAsanaNames()
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun addAsana(
        selectedName: String?,
        newNameRu: String?,
        newNameSanskrit: String?,
        transliteration: String?,
        definition: String?,
        selectedSource: String?,
        newSourceTitle: String?,
        newSourceAuthor: String?,
        newSourceYear: String?,
        newSourcePublisher: String?,
        newSourcePages: String?,
        newSourceAnnotation: String?,
        photos: List<File>
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.addAsana(
                selectedName, newNameRu, newNameSanskrit, transliteration, definition,
                selectedSource, newSourceTitle, newSourceAuthor, newSourceYear,
                newSourcePublisher, newSourcePages, newSourceAnnotation, photos
            )
                .onSuccess {
                    // Success
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun addSource(
        title: String,
        author: String,
        year: String?,
        publisher: String?,
        pages: String?,
        annotation: String?
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.addSource(title, author, year, publisher, pages, annotation)
                .onSuccess {
                    // Success
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
}







