package com.yoga.dict.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.yoga.dict.ui.viewmodel.AsanaManagementViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddSourceScreen(
    onBack: () -> Unit,
    onSuccess: () -> Unit,
    viewModel: AsanaManagementViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    
    var title by remember { mutableStateOf("") }
    var author by remember { mutableStateOf("") }
    var year by remember { mutableStateOf("") }
    var publisher by remember { mutableStateOf("") }
    var pages by remember { mutableStateOf("") }
    var annotation by remember { mutableStateOf("") }
    
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    
    // Отслеживаем успешное добавление
    var wasAdding by remember { mutableStateOf(false) }
    LaunchedEffect(error, isLoading) {
        if (wasAdding && error == null && !isLoading) {
            Toast.makeText(context, "Источник успешно добавлен", Toast.LENGTH_SHORT).show()
            onSuccess()
            wasAdding = false
        } else if (wasAdding && error != null) {
            Toast.makeText(context, "Ошибка: $error", Toast.LENGTH_LONG).show()
            wasAdding = false
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Добавить источник") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        IconButton(
                            onClick = {
                                if (title.isNotBlank() && author.isNotBlank()) {
                                    wasAdding = true
                                    viewModel.addSource(
                                        title = title,
                                        author = author,
                                        year = year.takeIf { it.isNotBlank() },
                                        publisher = publisher.takeIf { it.isNotBlank() },
                                        pages = pages.takeIf { it.isNotBlank() },
                                        annotation = annotation.takeIf { it.isNotBlank() }
                                    )
                                } else {
                                    Toast.makeText(context, "Заполните обязательные поля", Toast.LENGTH_SHORT).show()
                                }
                            }
                        ) {
                            Icon(Icons.Default.Check, contentDescription = "Сохранить")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Информация об источнике",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Название источника *") },
                        leadingIcon = { Icon(Icons.Default.Book, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = author,
                        onValueChange = { author = it },
                        label = { Text("Автор *") },
                        leadingIcon = { Icon(Icons.Default.Person, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = year,
                            onValueChange = { if (it.all { char -> char.isDigit() }) year = it },
                            label = { Text("Год издания") },
                            leadingIcon = { Icon(Icons.Default.CalendarToday, null) },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        
                        OutlinedTextField(
                            value = pages,
                            onValueChange = { pages = it },
                            label = { Text("Страницы") },
                            leadingIcon = { Icon(Icons.Default.List, null) },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                    
                    OutlinedTextField(
                        value = publisher,
                        onValueChange = { publisher = it },
                        label = { Text("Издательство") },
                        leadingIcon = { Icon(Icons.Default.Business, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = annotation,
                        onValueChange = { annotation = it },
                        label = { Text("Аннотация") },
                        leadingIcon = { Icon(Icons.Default.Description, null) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        maxLines = 5
                    )
                }
            }
            
            error?.let {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }
    }
}
